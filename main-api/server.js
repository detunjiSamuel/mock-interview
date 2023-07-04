const express = require('express');
const mongoose = require('mongoose');
const app = express();
const router = require('./src/routes/routes');

app.get('/', (req, res) => {
  res.send('Hello from App Engine!');
});


app.use('/api', router);

app.use((err, req, res, next) => {

 

 return res.status(500).json({
  msg: err,
});

})

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  await mongoose.connect(process.env.MONGO_ATLAS_URI)
  console.log(`Server listening on port ${PORT}...`);
});