const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "feedback.json");

/* ===============================
   Utility Functions
================================= */

function readData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ===============================
   Start Session
================================= */

app.post("/start-session", (req, res) => {
    const { name } = req.body;

    const newSession = {
        id: uuidv4(),
        name: name || "Anonymous",
        answers: {},
        completed: false,
        lastUpdated: new Date()
    };

    const data = readData();
    data.push(newSession);
    saveData(data);

    res.json({ sessionId: newSession.id });
});

/* ===============================
   Save Answer
================================= */

app.post("/save-answer", (req, res) => {
    const { sessionId, questionId, answer } = req.body;

    const data = readData();
    const session = data.find(s => s.id === sessionId);

    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }

    session.answers[questionId] = answer;
    session.lastUpdated = new Date();

    saveData(data);

    res.json({ success: true });
});

/* ===============================
   Complete Session
================================= */

app.post("/complete-session", (req, res) => {
    const { sessionId } = req.body;

    const data = readData();
    const session = data.find(s => s.id === sessionId);

    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }

    session.completed = true;
    session.lastUpdated = new Date();

    saveData(data);

    res.json({ success: true });
});

/* ===============================
   ADMIN ROUTE (Styled Dashboard)
================================= */

app.get("/admin", (req, res) => {

    const password = req.query.password;

    if (password !== ADMIN_PASSWORD) {
        return res.send(`
        <html>
        <head>
        <title>Admin Login</title>
        <style>
            body {
                margin:0;
                height:100vh;
                display:flex;
                justify-content:center;
                align-items:center;
                background:linear-gradient(135deg,#667eea,#764ba2,#ff6a88);
                font-family:Arial;
                color:white;
            }
            .card {
                background:rgba(255,255,255,0.15);
                backdrop-filter:blur(20px);
                padding:40px;
                border-radius:20px;
                text-align:center;
                box-shadow:0 20px 50px rgba(0,0,0,0.4);
            }
            input {
                padding:12px;
                border:none;
                border-radius:10px;
                margin-top:15px;
                width:220px;
                font-size:14px;
            }
            button {
                margin-top:15px;
                padding:10px 25px;
                border:none;
                border-radius:10px;
                font-weight:bold;
                cursor:pointer;
            }
        </style>
        </head>
        <body>
            <div class="card">
                <h2>🔐 Secure Admin Access</h2>
                <form method="GET" action="/admin">
                    <input type="password" name="password" placeholder="Enter password" required />
                    <br/>
                    <button type="submit">Login</button>
                </form>
            </div>
        </body>
        </html>
        `);
    }

    const data = readData().filter(s => s.completed);

    const totalResponses = data.length;

    let confidenceScores = [];
    let personalityCounts = {};
    let standoutCounts = {};

    data.forEach(session => {
        const answers = session.answers;

        if (answers.confidence) {
            confidenceScores.push(Number(answers.confidence));
        }

        if (answers.personality && Array.isArray(answers.personality)) {
            answers.personality.forEach(trait => {
                personalityCounts[trait] = (personalityCounts[trait] || 0) + 1;
            });
        }

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
    <title>Analytics Dashboard</title>
    <style>
        body {
            margin:0;
            padding:40px;
            font-family:Arial;
            background:linear-gradient(135deg,#667eea,#764ba2,#ff6a88);
            color:white;
        }

        h1 { margin-bottom:30px; }

        .grid {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:25px;
        }

        .card {
            background:rgba(255,255,255,0.15);
            backdrop-filter:blur(20px);
            padding:25px;
            border-radius:20px;
            box-shadow:0 20px 50px rgba(0,0,0,0.3);
        }

        .metric {
            font-size:36px;
            font-weight:bold;
        }

        .response {
            background:rgba(0,0,0,0.2);
            padding:20px;
            border-radius:15px;
            margin-bottom:20px;
        }

        .tag {
            display:inline-block;
            padding:5px 10px;
            border-radius:20px;
            background:rgba(255,255,255,0.2);
            margin:3px;
            font-size:12px;
        }
    </style>
    </head>

    <body>

    <h1>📊 Perception Analytics</h1>

    <div class="grid">
        <div class="card">
            <h3>Total Responses</h3>
            <div class="metric">${totalResponses}</div>
        </div>

        <div class="card">
            <h3>Average Confidence</h3>
            <div class="metric">${avgConfidence} / 10</div>
        </div>
    </div>

    <h2 style="margin-top:40px;">📋 Individual Responses</h2>

    ${data.map(session => `
        <div class="response">
            <h3>👤 ${session.name}</h3>
            <p><strong>Submitted:</strong> ${new Date(session.lastUpdated).toLocaleString()}</p>

            ${session.answers.personality ? `
                <p><strong>Personality:</strong><br/>
                ${session.answers.personality.map(t => `<span class="tag">${t}</span>`).join("")}
                </p>
            ` : ""}

            ${session.answers.standout ? `
                <p><strong>Standout Areas:</strong><br/>
                ${session.answers.standout.map(a => `<span class="tag">${a}</span>`).join("")}
                </p>
            ` : ""}

            ${session.answers.confidence ? `
                <p><strong>Confidence:</strong> ${session.answers.confidence} / 10</p>
            ` : ""}

            ${session.answers.advice ? `
                <p><strong>Brutal Advice:</strong><br/>
                ${session.answers.advice}
                </p>
            ` : ""}
        </div>
    `).join("")}

    </body>
    </html>
    `);
});

/* =============================== */

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});