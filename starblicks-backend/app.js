require('dotenv').config();
console.log("🔍 OPENAI KEY STATUS:", process.env.OPENAI_API_KEY ? "LOADED" : "MISSING");

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const app = express();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("Starblicks backend online 🚀");
});

app.post("/ingest", upload.fields([{ name: "agent_audio" }, { name: "customer_audio" }]), async (req, res) => {
  try {
    let agentPath = req.files["agent_audio"][0].path;
    let customerPath = req.files["customer_audio"][0].path;

    console.log("Files received:");
    console.log("Agent:", agentPath);
    console.log("Customer:", customerPath);

    function ensureMp3(sourcePath) {
        const newPath = sourcePath + ".mp3";
        fs.renameSync(sourcePath, newPath);
        return newPath;
    }

    agentPath = ensureMp3(agentPath);
    customerPath = ensureMp3(customerPath);

    async function transcribe(file) {
      const audioData = fs.createReadStream(file);
      const transcript = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: audioData,
          response_format: "text"
      });
      return transcript;
    }

    console.log("🔁 Running Whisper transcription...");
    const agentText = await transcribe(agentPath);
    const customerText = await transcribe(customerPath);

    console.log("🎤 Agent Transcript:", agentText);
    console.log("🗣️ Customer Transcript:", customerText);

    // ASYNC GPT QA — no response wait
    (async () => {

      console.log("🔎 Running GPT QA...");

      const auditPrompt = `
      You are a call QA auditor for NBFC loan recovery.
      Evaluate CALL TRANSCRIPT.

      AGENT:
      ${agentText}

      CUSTOMER:
      ${customerText}

      Output JSON:
      {
       "call_summary": "...",
       "customer_sentiment": "...",
       "agent_professionalism_score": 0-10,
       "urgency_creation_score": 0-10,
       "negative_keywords_detected": [],
       "rbi_violation_detected": true/false
      }`;

      const qa = await openai.chat.completions.create({
        model: "gpt-4.1",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: auditPrompt }]
      });

      console.log("🔍 QA RESULT:", qa.choices[0].message.content);

      // TODO: later → save to database

    })();

    // FAST RESPONSE to Render server
    return res.json({ status: "ok", message: "Audio received → processing in background" });

  } catch (error) {
    console.error("❗ Starblicks Error:", error);
    res.status(500).json({
      status: "error",
      message: "Processing failed",
      error: String(error.message || error)
    });
  }
});

app.listen(4000, () => console.log("Starblicks backend running on port 4000"));
