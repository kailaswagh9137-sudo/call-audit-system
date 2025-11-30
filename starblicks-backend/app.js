require('dotenv').config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");

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
        const agentPath = req.files["agent_audio"][0].path;
        const customerPath = req.files["customer_audio"][0].path;

        console.log("Files received:");
        console.log("Agent:", agentPath);
        console.log("Customer:", customerPath);

        async function transcribe(file) {
            const audioData = fs.createReadStream(file);
            const transcript = await openai.audio.transcriptions.create({
                model: "gpt-4o-mini-transcribe",
                file: audioData
            });
            return transcript.text;
        }

        console.log("🔁 Running Whisper transcription...");

        const agentText = await transcribe(agentPath);
        const customerText = await transcribe(customerPath);

        console.log("🎤 Agent Transcript:", agentText);
        console.log("🗣️ Customer Transcript:", customerText);

        return res.json({
            status: "ok",
            message: "Transcription successful",
            transcription: {
                agent: agentText,
                customer: customerText
            }
        });

    } catch (error) {
        console.error("❗ Starblicks Error:", error);
        res.status(500).json({
            status: "error",
            message: "Whisper failed",
            error: String(error.message || error)
        });
    }
});

app.listen(4000, () => console.log("Starblicks backend running on port 4000"));
