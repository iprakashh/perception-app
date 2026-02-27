const express = require("express");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "localdev123";

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

    const password = req.query.password;

    if (password !== ADMIN_PASSWORD) {
        return res.send(`
        <html>
        <head>
        <title>Admin Login</title>
        <style>
            body {
                height:100vh;
                display:flex;
                justify-content:center;
                align-items:center;
                background:linear-gradient(135deg,#667eea,#764ba2);
                font-family:Arial;
                color:white;
            }
            .card {
                background:rgba(255,255,255,0.15);
                padding:40px;
                border-radius:15px;
                backdrop-filter:blur(20px);
                text-align:center;
            }
            input {
                padding:12px;
                border:none;
                border-radius:8px;
                margin-bottom:15px;
                width:200px;
            }
            button {
                padding:10px 20px;
                border:none;
                border-radius:8px;
                cursor:pointer;
                font-weight:bold;
            }
        </style>
        </head>
        <body>
            <div class="card">
                <h2>🔐 Admin Access</h2>
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

    // ====== YOUR EXISTING ANALYTICS CODE BELOW ======

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
    <h1>📊 Analytics</h1>
    <p>Total Responses: ${totalResponses}</p>
    <p>Average Confidence: ${avgConfidence}</p>
    <pre>${JSON.stringify(data,null,2)}</pre>
    `);
});
/* ===============================
   Start Server
================================ */

app.listen(PORT, () => {
    console.log("🚀 Server running at http://localhost:3000");
});