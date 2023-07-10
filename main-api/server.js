require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const router = require("./src/routes/routes");

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from App Engine!");
});

app.use("/api", router);

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({
    msg: "internal error",
    err : err.message,
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  await mongoose
    .connect(process.env.MONGO_ATLAS_URI)
    .then(() => console.log("DB Connected!"))
    .catch((err) => console.log("DB error"));

  console.log(`Server listening on port ${PORT}...`);
});
