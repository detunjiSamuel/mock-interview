const mongoose = require("mongoose");


const questionSchema = new mongoose.Schema({
  video_url: String,
  title: String,
  text : String,
  helpful_tip: String,
  difficulty: Number,
});

const questionModel = mongoose.model('Question', questionSchema);

module.exports = questionModel;