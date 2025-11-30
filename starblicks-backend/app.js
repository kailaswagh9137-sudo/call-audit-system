const express = require("express");
const multer = require("multer");

const app = express();
const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
    res.send("Starblicks backend online 🚀");
});

// receive agent+customer audio
app.post("/ingest", upload.fields([{ name: "agent_audio" }, { name: "customer_audio" }]), (req, res) => {
    console.log("Received audio at Starblicks:");
    console.log("Agent:", req.files["agent_audio"][0].path);
    console.log("Customer:", req.files["customer_audio"][0].path);

    res.json({ status: "ok", message: "Audio received by Starblicks 👍" });
});

app.listen(4000, () => console.log("Starblicks backend running on port 4000"));
