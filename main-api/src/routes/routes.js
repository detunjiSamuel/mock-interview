const express = require("express");

const interviewModel = require("../models/interview");
const questionModel = require("../models/question");
const userModel = require("../models/user");

const multer = require("multer");
const multerGoogleStorage = require("multer-google-storage");

const router = express.Router();

const path = require("path");

const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const mongoose = require("mongoose");

const createHttpTaskWithToken = require("./feedbackTask");

const keyFilePath = path.join(__dirname, "..", "secret.json");

const projectId = process.env.PROJECT_ID;
const bucket = process.env.CLOUD_STORAGE_BUCKET;

const uploadHandler = multer({
  storage: multerGoogleStorage.storageEngine({
    autoRetry: true,
    bucket,
    projectId,
    keyFilename: keyFilePath,
    filename: (req, file, cb) => {
      cb(null, `/interview-responses/${Date.now()}_${file.originalname}`);
    },
    acl: "publicRead",
  }),
});

async function processRecording({ interview, recording_path, question }) {
  /**
   *  Add to queue for processing
   *
   */

  const payload = {
    interview,
    recording_path,
    question,
  };
  console.log("adding to queue", payload);

  await createHttpTaskWithToken(payload);
}

// Middleware

const clientAuth =
  (enforce = false) =>
  async (req, res, next) => {
    const token = req.headers.authorization?.split(" ");

    if (!token && !enforce) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.body.user = await userModel.find({
        email: decoded.email,
      });
      next();
    } catch (error) {
      if (!enforce) next();
      else return res.status(500).send("Invalid token");
    }
  };

const appAuth = (req, res, next) => {
  const { app_id } = req.body;

  if (app_id === process.env.APP_ID) {
    next();
  } else {
    return res.status(500).send("Invalid app_id");
  }
};

//routes

router.post(
  "/submit-recording",
  clientAuth(true),
  uploadHandler.single("audio_response"),
  async (req, res, next) => {
    if (!req.file) throw new Error("No file uploaded");

    const { question_id, user } = req.body;

    const questionAsked = await questionModel.findOne({
      title: question_id.toLowerCase(),
    });

    if (!questionAsked) throw new Error("Invalid question id");

    const interview = await interviewModel.create({
      question: questionAsked._id,
      user: user._id,
      audio_url: "gs://interview-project-bucket/" + req.file.filename,
    });

    await processRecording({
      interview: interview._id,
      recording_path: interview.audio_url,
      question: questionAsked.text,
    });

    return res.status(200).json({
      message: "success",
      file: req.file,
      interview: interview._id,
    });
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

router.get("/questions/:slug", async (req, res, next) => {
  try {
    const { slug = "internal-test" } = req.params;

    const question = await questionModel.findOne({ title: slug.toLowerCase() });

    if (!question) throw new Error("Invalid question");

    return res.status(200).json({ question });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/questions/:slug/feedback",
  clientAuth(true),
  async (req, res, next) => {
    try {
      const { slug } = req.params;

      const { user } = req.body;

      const question = await questionModel.findOne({
        title: slug.toLowerCase(),
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
    const { user } = req.body;

    const { page = 1, limit = 10 } = req.query;

    const questions = await questionModel
      .find({})
      .skip((page - 1) * limit)
      .limit(limit);

    if (user && questions) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        const interview = await interviewModel.findOne({
          question: question._id,
          user: user._id,
        });

        if (interview) {
          question.status = true;
        }
      }
    }

    return res.status(200).json({ questions });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/interviews/:id/feedback",
  clientAuth(true),
  async (req, res, next) => {
    try {
      // get specific interview feedback

      const { id } = req.params;
      const { user } = req.body;

      if (mongoose.Types.ObjectId.isValid(id)) {
        const interview = await interviewModel.findById(
          mongoose.Types.ObjectId(id)
        );

        if (!interview.user != user._id)
          throw new Error("Invalid interview id");

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

    const hashedPassword = bcrypt.hash(password, 10);

    await userModel.create({
      email,
      password: hashedPassword,
    });

    const token = jsonwebtoken.sign({ email }, process.env.JWT_SECRET, {
      algorithm: "HS256",
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
    });

    return res.status(200).json({ email, token });
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
