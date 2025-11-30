const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const axios = require("axios");
const FormData = require("form-data");

const app = express();

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

    const inputFile = req.file.path;
    const baseName = path.parse(req.file.originalname).name;

    const agentOut = `processed/${baseName}_agent.mp3`;
    const customerOut = `processed/${baseName}_customer.mp3`;

    const cmd = `"${ffmpegPath}" -i "${inputFile}" -map_channel 0.0.0 "${agentOut}" -map_channel 0.0.1 "${customerOut}"`;

    console.log("Running FFmpeg:", cmd);

    await new Promise((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) {
          return reject(err);
        }
        console.log("FFmpeg done");
        resolve();
      });
    });

    // SEND TO STARBLICKS ASYNC
    const form = new FormData();
    form.append("agent_audio", fs.createReadStream(agentOut));
    form.append("customer_audio", fs.createReadStream(customerOut));

    axios.post("https://starblicks-audit-system.onrender.com/ingest", form, {
      headers: form.getHeaders()
    })
    .then(() => console.log("Starblicks received audio"))
    .catch(err => console.error("Error sending to Starblicks:", err));

    return res.json({
      status: "ok",
      message: "Audio split & Starblicks को भेज दिया गया — processing in background",
      agent_audio: agentOut,
      customer_audio: customerOut
    });

  } catch (error) {
    console.error("Upload route error:", error);
    return res.status(500).json({
      status: "error",
      message: "Processing failed",
      error: String(error.message || error)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
