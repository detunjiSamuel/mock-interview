require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const { setupRabbitMQ } = require("./src/services/rabbitMQ");
const app = express();
const router = require("./src/routes/routes");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Interview Practice API is running!");
});

app.use("/api", router);

app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);

  return res.status(err.status || 500).json({
    msg: err.message || "internal error",
    err:
      process.env.NODE_ENV === "production" ? "An error occurred" : err.stack,
  });
});

// Set up connection to MongoDB and RabbitMQ, then start the server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/interview"
    );
    console.log("✅ MongoDB Connected!");

    // Set up RabbitMQ connection
    await setupRabbitMQ();
    console.log("✅ RabbitMQ Connected!");

    // Start the server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}...`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
