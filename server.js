const express = require("express");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const filePath = __dirname + "/feedback.json";

/* ===============================
   Utility Functions
================================ */

function readData() {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath);
    return raw.length ? JSON.parse(raw) : [];
}

function writeData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/* ===============================
   Start Session
================================ */

app.post("/start-session", (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Name is required" });
    }

    const data = readData();

    const newSession = {
        id: uuidv4(),
        name,
        answers: {},
        completed: false,
        lastUpdated: new Date()
    };

    data.push(newSession);
    writeData(data);

    res.json({ sessionId: newSession.id });
});

/* ===============================
   Save Answer (Auto Save)
================================ */

app.post("/save-answer", (req, res) => {
    const { sessionId, questionId, answer } = req.body;

    const data = readData();
    const session = data.find(s => s.id === sessionId);

    if (!session) {
        return res.status(404).json({ message: "Session not found" });
    }

    session.answers[questionId] = answer;
    session.lastUpdated = new Date();

    writeData(data);

    res.json({ message: "Answer saved successfully" });
});

/* ===============================
   Complete Session
================================ */

app.post("/complete-session", (req, res) => {
    const { sessionId } = req.body;

    const data = readData();
    const session = data.find(s => s.id === sessionId);

    if (!session) {
        return res.status(404).json({ message: "Session not found" });
    }

    session.completed = true;
    session.lastUpdated = new Date();

    writeData(data);

    res.json({ message: "Feedback completed successfully" });
});

/* ===============================
   Admin Analytics Dashboard
================================ */

app.get("/admin", (req, res) => {

    const data = readData().filter(s => s.completed);

    const totalResponses = data.length;

    let confidenceScores = [];
    let personalityCounts = {};
    let standoutCounts = {};

    data.forEach(session => {
        const answers = session.answers;

        // Confidence score
        if (answers.confidence) {
            confidenceScores.push(Number(answers.confidence));
        }

        // Personality traits
        if (answers.personality && Array.isArray(answers.personality)) {
            answers.personality.forEach(trait => {
                personalityCounts[trait] = (personalityCounts[trait] || 0) + 1;
            });
        }

        // Standout areas
        if (answers.standout && Array.isArray(answers.standout)) {
            answers.standout.forEach(area => {
                standoutCounts[area] = (standoutCounts[area] || 0) + 1;
            });
        }
    });

    const avgConfidence = confidenceScores.length
        ? (confidenceScores.reduce((a,b)=>a+b,0) / confidenceScores.length).toFixed(2)
        : 0;

    res.send(`
    <html>
    <head>
    <title>Perception Analytics</title>
    <style>
        body {
            margin:0;
            padding:40px;
            font-family:Arial, sans-serif;
            background:linear-gradient(135deg,#667eea,#764ba2);
            color:white;
        }

        h1 {
            margin-bottom:30px;
        }

        .grid {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:25px;
        }

        .card {
            background:rgba(255,255,255,0.15);
            backdrop-filter:blur(20px);
            padding:25px;
            border-radius:15px;
            box-shadow:0 10px 30px rgba(0,0,0,0.3);
        }

        .metric {
            font-size:40px;
            font-weight:bold;
            margin-top:10px;
        }

        .bar {
            margin:12px 0;
        }

        .bar-label {
            font-size:14px;
        }

        .bar-fill {
            height:10px;
            border-radius:5px;
            background:linear-gradient(90deg,#00f5a0,#00d9f5,#ff6a88);
        }

        .raw {
            background:rgba(0,0,0,0.2);
            padding:15px;
            border-radius:10px;
            font-size:12px;
            overflow:auto;
            max-height:300px;
        }
    </style>
    </head>

    <body>

    <h1>📊 Perception Analytics Dashboard</h1>

    <div class="grid">

        <div class="card">
            <h3>Total Responses</h3>
            <div class="metric">${totalResponses}</div>
        </div>

        <div class="card">
            <h3>Average Confidence</h3>
            <div class="metric">${avgConfidence} / 10</div>
        </div>

        <div class="card">
            <h3>Personality Traits</h3>
            ${
                Object.entries(personalityCounts).map(([key,value]) => `
                    <div class="bar">
                        <div class="bar-label">${key} (${value})</div>
                        <div class="bar-fill" style="width:${value * 12}px"></div>
                    </div>
                `).join("")
            }
        </div>

        <div class="card">
            <h3>Standout Areas</h3>
            ${
                Object.entries(standoutCounts).map(([key,value]) => `
                    <div class="bar">
                        <div class="bar-label">${key} (${value})</div>
                        <div class="bar-fill" style="width:${value * 12}px"></div>
                    </div>
                `).join("")
            }
        </div>

    </div>

    <div class="card" style="margin-top:30px;">
    <h3>📋 Individual Responses</h3>

    ${data.map(session => `
        <div style="
            background:rgba(0,0,0,0.2);
            padding:20px;
            border-radius:12px;
            margin-bottom:20px;
        ">

            <h4 style="margin-top:0;">
                👤 ${session.name}
            </h4>

            <p><strong>Submitted:</strong> 
                ${new Date(session.lastUpdated).toLocaleString()}
            </p>

            ${session.answers.personality ? `
                <p><strong>Personality:</strong></p>
                <ul>
                    ${session.answers.personality.map(trait => `<li>${trait}</li>`).join("")}
                </ul>
            ` : ""}

            ${session.answers.standout ? `
                <p><strong>Standout Areas:</strong></p>
                <ul>
                    ${session.answers.standout.map(area => `<li>${area}</li>`).join("")}
                </ul>
            ` : ""}

            ${session.answers.confidence ? `
                <p><strong>Confidence Score:</strong> 
                    <span style="font-size:18px;font-weight:bold;">
                        ${session.answers.confidence} / 10
                    </span>
                </p>
            ` : ""}

            ${session.answers.advice ? `
                <p><strong>Brutal Advice:</strong></p>
                <div style="
                    background:rgba(255,255,255,0.1);
                    padding:12px;
                    border-radius:8px;
                ">
                    ${session.answers.advice}
                </div>
            ` : ""}

        </div>
    `).join("")}

</div>

    </body>
    </html>
    `);
});

/* ===============================
   Start Server
================================ */

app.listen(PORT, () => {
    console.log("🚀 Server running at http://localhost:3000");
});