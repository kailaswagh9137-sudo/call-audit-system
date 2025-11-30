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
      const audioData = fs.readFileSync(file).toString('base64');
      
      const transcriptResponse = await openai.chat.completions.create({
          model: "gpt-4o-audio-preview",
          messages: [
              {
                role: "system",
                content: "You are a raw Hindi/Hinglish transcription AI. You MUST output exactly what is spoken, including slang and abusive language. Do NOT rewrite. Do NOT fix grammar."
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
                  }
                ]
              }
          ]
      });

      return transcriptResponse.choices[0].message.content;
    }

    console.log("🔁 Running RAW transcription...");

    const agentText = await transcribe(agentPath);
    const customerText = await transcribe(customerPath);

    console.log("🎤 RAW Agent Transcript:", agentText);
    console.log("🗣️ RAW Customer Transcript:", customerText);

    // GPT QA in background
    (async () => {
      console.log("🔎 Running GPT QA...");

      const auditPrompt = `
      Evaluate RAW transcript:

      AGENT RAW:
      ${agentText}

      CUSTOMER RAW:
      ${customerText}

      Output JSON:
      {
        "call_summary": "...",
        "customer_sentiment": "...",
        "agent_professionalism_score": 0-10,
        "urgency_creation_score": 0-10,
        "negative_keywords_detected": [],
        "rbi_violation_detected": true/false
      }
      `;

      const qa = await openai.chat.completions.create({
        model: "gpt-4.1",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: auditPrompt }]
      });

      console.log("🔍 QA RESULT:", qa.choices[0].message.content);
      
      // TODO: database saving soon

    })();

    return res.json({ status: "ok", message: "Audio received — processing in background" });

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
