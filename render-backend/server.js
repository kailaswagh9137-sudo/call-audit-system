const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const app = express();

// uploads aur processed folders ke liye
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("processed")) fs.mkdirSync("processed");

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send("Render FFmpeg server running ✅");
});

app.post("/upload", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: "error", message: "No audio file uploaded" });
  }

  const inputFile = req.file.path; // e.g. uploads/xyz.mp3
  const baseName = path.parse(req.file.originalname).name;

  const agentOut = `processed/${baseName}_agent.mp3`;
  const customerOut = `processed/${baseName}_customer.mp3`;

  // FFmpeg command with correct binary path
  const cmd = `"${ffmpegPath}" -i "${inputFile}" -map_channel 0.0.0 "${agentOut}" -map_channel 0.0.1 "${customerOut}"`;

  console.log("Running:", cmd);

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("FFmpeg error:", err);
      console.error(stderr);
      return res.status(500).json({ status: "error", message: "FFmpeg failed", error: String(err) });
    }

    console.log("FFmpeg done");
    return res.json({
      status: "ok",
      agent_audio: agentOut,
      customer_audio: customerOut
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
