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

    async function transcribe(file, speakerLabel) {
      const audioData = fs.readFileSync(file).toString('base64');

      const transcriptResponse = await openai.chat.completions.create({
          model: "gpt-4o-audio-preview",
          messages: [
            {
              role: "system",
              content: "You are a Hindi/Hinglish raw speech transcription engine with diarization formatting."
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: audioData,
                    format: "mp3"
                  }
                },
                {
                  type: "text",
                  text: `Return output EXACTLY in this format:\n\n${speakerLabel} <timestamp in seconds>\n<spoken line>\n\nRules:\n• DO NOT rewrite or paraphrase\n• DO NOT correct grammar\n• EXACT spoken words only\n• Keep filler words (haan, hmm, arre, ok)\n• Show timestamps at natural pauses\n• Keep profanity uncensored`
                }
              ]
            }
          ]
      });

      return transcriptResponse.choices[0].message.content;
    }

    console.log("🔁 Running diarized formatted transcription...");

    const agentText = await transcribe(agentPath, "Agent");
    const customerText = await transcribe(customerPath, "Customer");

    console.log("🎤 Agent Formatted Transcript:\n", agentText);
    console.log("🗣️ Customer Formatted Transcript:\n", customerText);

    // GPT QA in background
    (async () => {
      console.log("🔎 Running GPT QA...");

      const auditPrompt = `
      Analyze the following RAW formatted transcript with timestamps and speaker labels.

      Agent Transcript:
      ${agentText}

      Customer Transcript:
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

    })();

    return res.json({ status: "ok", message: "Audio received — diarized transcription running" });

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
