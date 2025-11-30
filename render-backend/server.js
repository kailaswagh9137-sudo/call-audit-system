const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const axios = require("axios");
const FormData = require("form-data");

const app = express();

// uploads aur processed folders ke liye
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("processed")) fs.mkdirSync("processed");

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send("Render FFmpeg server running ✅");
});

app.post("/upload", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No audio file uploaded" });
    }

    const inputFile = req.file.path; // e.g. uploads/xyz.mp3
    const baseName = path.parse(req.file.originalname).name;

    const agentOut = `processed/${baseName}_agent.mp3`;
    const customerOut = `processed/${baseName}_customer.mp3`;

    // FFmpeg command with correct binary path
    const cmd = `"${ffmpegPath}" -i "${inputFile}" -map_channel 0.0.0 "${agentOut}" -map_channel 0.0.1 "${customerOut}"`;

    console.log("Running FFmpeg:", cmd);

    // 1) Pehle FFmpeg run karo
    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.error("FFmpeg error:", err);
          console.error(stderr);
          return reject(err);
        }
        console.log("FFmpeg done");
        resolve();
      });
    });

    // 2) Ab Starblicks ko bhejna hai
    const form = new FormData();
    form.append("agent_audio", fs.createReadStream(agentOut));
    form.append("customer_audio", fs.createReadStream(customerOut));

    console.log("Sending files to Starblicks...");

    const starblicksResponse = await axios.post(
      "https://starblicks-audit-system.onrender.com/ingest",
      form,
      { headers: form.getHeaders() }
    );

    console.log("Starblicks response:", starblicksResponse.data);

    // 3) Client ko final response
    return res.json({
      status: "ok",
      message: "Audio split ho gaya aur Starblicks ko send kar diya.",
      starblicks_result: starblicksResponse.data,
      agent_audio: agentOut,
      customer_audio: customerOut
    });

  } catch (error) {
    console.error("Upload route error:", error);
    return res.status(500).json({
      status: "error",
      message: "Koi error aa gaya (FFmpeg ya Starblicks).",
      error: String(error.message || error)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
