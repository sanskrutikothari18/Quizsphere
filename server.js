const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/*
rooms = {
  "123456": {
    quiz: { id, title, questions, timer },
    state: "waiting" | "playing",
    players: {
      "Alice": { email: "alice@x.com", correct: 0, time: 0, finished: false }
    }
  }
}
*/
const rooms = {};

// POST /api/create -> Teacher creates a room with the quiz
app.post('/api/create', (req, res) => {
  const { quiz, requestedPin } = req.body;
  if (!quiz) return res.status(400).json({ error: 'Quiz data required' });

  // Use requestedPin or generate a random 6-digit pin
  const pin = requestedPin && /^\d{6}$/.test(requestedPin)
    ? requestedPin
    : Math.floor(100000 + Math.random() * 900000).toString();

  rooms[pin] = {
    quiz: quiz,
    state: 'waiting',
    players: {}
  };

  console.log(`[CREATE] Room ${pin} created: "${quiz.title}" (${quiz.questions.length} questions)`);
  res.json({ success: true, pin });
});

// POST /api/join -> Student joins a room
app.post('/api/join', (req, res) => {
  const { pin, name, email } = req.body;
  if (!pin || !name) return res.status(400).json({ error: 'Missing pin or name' });

  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'No quiz found for this PIN. Ask your teacher if the quiz has been started.' });

  if (room.state !== 'waiting') return res.status(403).json({ error: 'Quiz has already started. You cannot join now.' });

  // Block duplicate names
  if (room.players[name]) {
    return res.status(403).json({ error: 'This name is already taken! Please choose a different name.' });
  }

  room.players[name] = { email: email || '', correct: 0, time: 0, finished: false };

  console.log(`[JOIN] "${name}" (${email || 'no email'}) joined room ${pin}`);
  res.json({ success: true, quizTitle: room.quiz.title });
});

// GET /api/room/:pin -> Returns room status and players (for teacher dashboard & student polling)
app.get('/api/room/:pin', (req, res) => {
  const pin = req.params.pin;
  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Map players to an array for easy sorting
  const scores = Object.keys(room.players).map(name => ({
    name,
    email: room.players[name].email,
    correct: room.players[name].correct,
    time: room.players[name].time,
    finished: room.players[name].finished,
    finishedAt: room.players[name].finishedAt || Infinity
  }));

  // Sort: finished players first (earliest submission time first). Unfinished players go to the bottom.
  scores.sort((a, b) => {
    if (a.finished !== b.finished) {
      return a.finished ? -1 : 1;
    }
    return a.finishedAt - b.finishedAt;
  });

  res.json({
    state: room.state,
    quiz: room.quiz,
    scores: scores,
    playerCount: scores.length
  });
});

// POST /api/start/:pin -> Teacher starts the quiz
app.post('/api/start/:pin', (req, res) => {
  const pin = req.params.pin;
  if (rooms[pin]) {
    rooms[pin].state = 'playing';
    console.log(`[START] Room ${pin} quiz started!`);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Room not found' });
});

// POST /api/score -> Student finishes quiz and submits score
app.post('/api/score', (req, res) => {
  const { pin, name, correct, time } = req.body;
  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.players[name]) {
    room.players[name].correct = correct;
    room.players[name].time = time;
    room.players[name].finished = true;
    room.players[name].finishedAt = Date.now(); // Record the exact submission timestamp
    console.log(`[SCORE] "${name}" in room ${pin}: ${correct} correct in ${time}s at ${room.players[name].finishedAt}`);
  }

  res.json({ success: true });
});

// DELETE /api/room/:pin -> Teacher closes/resets the room
app.delete('/api/room/:pin', (req, res) => {
  const pin = req.params.pin;
  if (rooms[pin]) {
    delete rooms[pin];
    console.log(`[DELETE] Room ${pin} deleted`);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Room not found' });
});

const os = require('os');
const { spawn } = require('child_process');

let tunnelUrl = '';
let localIp = '127.0.0.1';

// Get local network IP
try {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
} catch (e) {
  console.error('Error getting local IP:', e);
}

// Start cloudflared tunnel
const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
console.log(`Starting Cloudflare tunnel using ${cloudflaredPath}...`);
const cloudflared = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${PORT}`]);

cloudflared.stdout.on('data', (data) => {
  parseCloudflaredOutput(data.toString());
});

cloudflared.stderr.on('data', (data) => {
  parseCloudflaredOutput(data.toString());
});

function parseCloudflaredOutput(text) {
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log(`\n========================================\n[TUNNEL] Live Cloudflare Tunnel: ${tunnelUrl}\n========================================\n`);
  }
}

// Cleanup cloudflared on exit
process.on('exit', () => {
  try { cloudflared.kill(); } catch (e) { }
});
process.on('SIGINT', () => {
  try { cloudflared.kill(); } catch (e) { }
  process.exit();
});
process.on('SIGTERM', () => {
  try { cloudflared.kill(); } catch (e) { }
  process.exit();
});

// GET /api/config -> Returns the tunnel URL and local IP
app.get('/api/config', (req, res) => {
  res.json({
    tunnelUrl: tunnelUrl,
    localIp: `http://${localIp}:${PORT}`
  });
});

// GET /api/health -> Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, rooms: Object.keys(rooms).length, tunnelUrl, localIp: `http://${localIp}:${PORT}` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
========================================
 QuizSphere Live Backend  
 Running on http://localhost:${PORT}
 Local IP: http://${localIp}:${PORT}
========================================
  `);
});
