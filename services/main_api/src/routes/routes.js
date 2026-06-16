const express = require("express");

const interviewModel = require("../models/interview");
const questionModel = require("../models/question");
const userModel = require("../models/user");

const multer = require("multer");

const router = express.Router();

const path = require("path");

const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const mongoose = require("mongoose");

const { sendToTranscriptService } = require("../services/rabbitMQ");

// TODO: include size limits and file type filters
const uploadHandlerWithDisk = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath =
        process.env.FILE_STORAGE_PATH || path.join(__dirname, "../../storage");
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix =
        Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        "-" +
        file.originalname;
      cb(null, file.fieldname + "-" + uniqueSuffix);
    },
  }),
});

// Middleware

const clientAuth =
  (enforce = false) =>
  async (req, res, next) => {
    const token = req.headers.authorization?.split(" ");
    if (!token && !enforce) {
      return next();
    }

    try {
      const decoded = jsonwebtoken.verify(token[1], process.env.JWT_SECRET);
      const user = await userModel.findOne({
        email: decoded.email,
      });
      if ( user)
       req.user = user;
      next();
    } catch (error) {
      console.log(error);
      if (!enforce) next();
      else return res.status(500).json({ err: "Invalid token" });
    }
  };

const appAuth = (req, res, next) => {
  const { app_id } = req.body;

  if (app_id === process.env.APP_ID) {
    next();
  } else {
    return res.status(500).send({ err: "Invalid app_id" });
  }
};

//routes

router.post(
  "/submit-recording",
  clientAuth(true),
  uploadHandlerWithDisk.single("audio_response"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new Error("No file uploaded");

      const user = req.user;

      const { question_id } = req.body;

      const questionAsked = await questionModel.findOne({
        slug: question_id.toLowerCase(),
      });

      if (!questionAsked) throw new Error("Invalid question id");

      const interview = await interviewModel.create({
        question: questionAsked._id,
        user: user._id,
        // audio_url: "gs://interview-project-bucket" + req.file.filename,
        audio_url: req.file.filename,
      });

      console.log(
        "sendToTranscriptService",
        interview._id.toString(),
        interview.audio_url,
        questionAsked.text
      );

      sendToTranscriptService({
        interview: interview._id.toString(),
        recording_path: interview.audio_url,
        question: questionAsked.text,
      });

      return res.status(200).json({
        message: "success",
        file: req.file,
        interview: interview._id.toString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/submit-feedback", appAuth, async (req, res, next) => {
  try {
    const { interview, feedback } = req.body;

    const interviewInstance = await interviewModel.findById(interview);

    if (!interviewInstance) throw new Error("Invalid interview id");

    interview.feedback = feedback;

    interview.save();

    return res.status(200).json({ message: "success" });
  } catch (error) {
    next(error);
  }
});

// Get specific question
router.get("/questions/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;

    const question = await questionModel.findOne({ slug: slug.toLowerCase() });

    if (!question) throw new Error("Question not found");

    return res.status(200).json({ question });
  } catch (error) {
    next(error);
  }
});

// Get feedback for specific question
router.get(
  "/questions/:slug/feedback",
  clientAuth(true),
  async (req, res, next) => {
    try {
      const { slug } = req.params;

      const user = req.user;

      const question = await questionModel.findOne({
        slug: slug.toLowerCase(),
      });

      if (!question) throw new Error("Invalid question");

      const interviews = await interviewModel.find({
        question: question._id,
        user: user._id,
      });

      return res.status(200).json({ interviews });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/questions", clientAuth(false), async (req, res, next) => {
  try {
    const user = req.user;

    const { page = 1, limit = 10, category, difficulty, search } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }
    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: "i" } },
        { text: { $regex: search, $options: "i" } },
      ];
    }

    const questions = await questionModel
      .find(query)
      .skip((parseInt(page) - 1) * limit)
      .limit(parseInt(limit))
      .sort({ topic: 1 });

    const total = await questionModel.countDocuments(query);

    if (user && questions.length > 0) {
      const questionIds = questions.map((q) => q._id);
      const interviews = await interviewModel.find({
        question: { $in: questionIds },
        user: user._id,
      });

      const questionStatusMap = {};
      interviews.forEach((interview) => {
        questionStatusMap[interview.question.toString()] = true;
      });

      // Add status to each question
      questions.forEach((question) => {
        question._doc.status = !!questionStatusMap[question._id.toString()];
      });
    }

    return res.status(200).json({
      questions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/interviews/:id/feedback",
  clientAuth(true),
  async (req, res, next) => {
    try {
      // get specific interview feedback for polling

      const { id } = req.params;
      const user = req.user;

      if (mongoose.Types.ObjectId.isValid(id)) {
        const interview = await interviewModel
          .findById(new mongoose.Types.ObjectId(id))
          .populate("question");
        
        if (interview.user.toString() != user._id.toString())
          throw new Error("Interview does not belong to user");

        return res.status(200).json({ interview });
      }

      throw new Error("Invalid interview id");
    } catch (error) {
      next(error);
    }
  }
);

router.post("/auth/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // check if email exists
    const userExists = await userModel.findOne({ email });

    if (userExists) throw new Error("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    await userModel.create({
      email,
      password: hashedPassword,
    });

    const token = jsonwebtoken.sign({ email }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "2d",
    });

    return res.status(200).json({ email, token });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // check if email exists
    const userExists = await userModel.findOne({ email });

    if (!userExists) throw new Error("Invalid user credentials");

    // check if password is correct

    const isPassword = bcrypt.compare(password, userExists.password);

    if (!isPassword) throw new Error("Invalid user credentials");

    const token = jsonwebtoken.sign({ email }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "2d",
    });

    return res.status(200).json({ email, token });
  } catch (error) {
    next(error);
  }
});

// Get user profile
router.get("/auth/profile", clientAuth(true), async (req, res, next) => {
  try {
    const user = req.user;

    // Don't send password
    const userProfile = {
      id: user._id,
      email: user.email,
    };

    return res.status(200).json({ user: userProfile });
  } catch (error) {
    next(error);
  }
});

router.post("/dev/add-questions", async (req, res, next) => {
  try {
    const { questions } = req.body;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      question.slug = question.topic.toLowerCase().split(" ").join("-");

      await questionModel.create({
        ...question,
      });
    }

    return res.status(200).json({ message: "success" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// router.get("/", async (req, res, next) => {
//   await processRecording({
//     interview: "gs-path",
//     recording_path: "gs://interview-project-bucket/projectimages/obama_out.wav",s
//     question: "why do you want to work here?",
//   });

//   await processRecording({
//     interview: "public-path",
//     recording_path:
//       "https://storage.googleapis.com/interview-project-bucket/projectimages/obama_out.wav",
//     question: "why do you want to work here?",
//   });

//   return res.status(200).json({ message: "success" });
// });
