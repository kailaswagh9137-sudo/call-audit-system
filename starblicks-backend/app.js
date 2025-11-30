app.post("/ingest", upload.fields([{ name: "agent_audio" }, { name: "customer_audio" }]), async (req, res) => {
    try {
        let agentPath = req.files["agent_audio"][0].path;
        let customerPath = req.files["customer_audio"][0].path;

        console.log("Files received:");
        console.log("Agent:", agentPath);
        console.log("Customer:", customerPath);

        // Ensure extension
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
