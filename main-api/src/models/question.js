import * as mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  video_url: String,
  title: String,
  text : String,
  helpful_tip: String,
  difficulty: Number,
});

const interviewModel = mongoose.model('Question', questionSchema);

export default interviewModel;