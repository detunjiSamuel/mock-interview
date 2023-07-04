const express = require("express");

const interviewModel = require("../models/interview");
const questionModel = require("../models/question");

const multer = require("multer");
const multerGoogleStorage = require("multer-google-storage");

const router = express.Router();

const path = require("path");

const createHttpTaskWithToken = require("./feedbackTask");

const keyFilePath = path.join(__dirname, "..", "secret.json");

const projectId = "august-charter-391200";
const bucket = "interview-project-bucket";


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



function processRecording({ interview , recording_path , question }) {
  /**
   *  Add to queue
   *
   */

  const payload = {
   interview , 
   recording_path , 
   question
  };

  createHttpTaskWithToken(payload);
}



router.post(
  "/submit-recording",
  uploadHandler.single("audio_response"),
  (req, res, next) => {

   if (!req.file)
     throw Error("No file uploaded");

   const { question_id , user } = req.body;

   const questionAsked = questionModel.findById(question_id);

   if (!questionAsked) 
     throw Error("Invalid question id");

   const interview = new interviewModel.create({
    question : questionAsked._id,
    user : user._id,
    audio_url : req.file.path
   })

    processRecording({
      interview: interview._id,
      recording_path : req.file.path,
      question :  questionAsked.text
    });

    return res.status(200).json({ message: "success", file: req.file });
  }
);


router.post('/submit-feedback', (req,res,next) => {

 // TODO : limit to independent services only

  const { interview , feedback } = req.body;

  const interviewInstance = interviewModel.findById(interview);

  if (!interviewInstance)
    throw Error("Invalid interview id");

  interview.feedback = feedback;

  interview.save();

  return res.status(200).json({ message: "success" });
})

module.exports = router;
