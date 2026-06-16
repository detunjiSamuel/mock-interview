const mongoose = require("mongoose");


const questionSchema = new mongoose.Schema({
  video_url: String,
  topic: String,
  text : String,
  helpful_tip: String,
  difficulty: String,
  category: String,
  slug : String
});

const questionModel = mongoose.model('Question', questionSchema);

module.exports = questionModel;