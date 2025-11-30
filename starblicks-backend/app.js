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

    // ---- TRUE RAW WHISPER TRANSCRIPTION ----
    async function transcribe(file) {
      const audioData = fs.createReadStream(file);

      const transcriptResp = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioData,
        language: "hi",
        temperature: 0,
        response_format: "verbose_json",
        prompt: "Transcribe EXACT spoken Hindi/Hinglish. DO NOT rewrite. DO NOT correct grammar. EXACT phonetic speech including mistakes, filler sounds (haan, hmm), slang, incomplete words."
      });

      return transcriptResp;
    }

    console.log("🔁 Running WHISPER TRUE RAW mode...");

    const agentWhisper = await transcribe(agentPath);
    const customerWhisper = await transcribe(customerPath);

    console.log("🎤 RAW Agent Whisper JSON:\n", agentWhisper);
    console.log("🗣️ RAW Customer Whisper JSON:\n", customerWhisper);

    // ---- BUILD TIMELINE ----

    function buildEntries(segments, speaker) {
      return segments.map(seg => ({
        speaker,
        timestamp: seg.start,
        text: seg.text.trim()
      }));
    }

    const agentEntries = buildEntries(agentWhisper.segments, "Agent");
    const customerEntries = buildEntries(customerWhisper.segments, "Customer");

    let merged = agentEntries.concat(customerEntries);
    merged.sort((a, b) => a.timestamp - b.timestamp);

    let finalTranscript = "";
    merged.forEach(m => {
      finalTranscript += `${m.timestamp.toFixed(1)}s ${m.speaker}: ${m.text}\n`;
    });

    console.log("🧩 FINAL RAW MERGED TRANSCRIPT:\n", finalTranscript);

    // ---- GPT QA (NO TRANSCRIPTION — ONLY ANALYSIS) ----

    console.log("🔎 Running GPT QA...");

    (async () => {
      const auditPrompt = `
      Analyze this call conversation BUT DO NOT rewrite any transcript:

      ${finalTranscript}

      Output JSON only:
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

      console.log("🔍 GPT QA RESULT:", qa.choices[0].message.content);
    })();

    return res.json({ status: "ok", message: "WHISPER transcription running — GPT QA in background" });

  } catch (error) {
    console.error("❗ STARBLICKS ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Processing failed",
      error: String(error.message || error)
    });
  }
});

app.listen(4000, () => console.log("Starblicks backend running on port 4000"));
