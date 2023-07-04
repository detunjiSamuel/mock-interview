import * as mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema({
  feedback: String,
  audio_transcript: String,
  audio_url: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
});

const interviewModel = mongoose.model('Interview', interviewSchema);

export default interviewModel;