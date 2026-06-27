const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Allow requests from Vercel frontend (set CORS_ORIGIN env var in Railway dashboard)
// Falls back to allowing all origins for local/dev use
const corsOptions = process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN.split(','), credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
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
    currentQuestionIndex: 0,
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

  room.players[name] = {
    email: email || '',
    score: 0,
    correctCount: 0,
    timeTaken: 0,
    lastQuestionAnswered: -1,
    finished: false
  };

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
    correct: room.players[name].correctCount,
    score: room.players[name].score || 0,
    time: parseFloat((room.players[name].timeTaken || 0).toFixed(2)),
    finished: room.players[name].finished,
    lastQuestionAnswered: room.players[name].lastQuestionAnswered,
    finishedAt: room.players[name].finishedAt || Infinity
  }));

  // Sort: 1. Highest Score, 2. If score equal -> Fastest Time.
  scores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.time - b.time;
  });

  // Assign ranking numbers
  scores.forEach((player, index) => {
    player.rank = index + 1;
  });

  res.json({
    state: room.state,
    quiz: room.quiz,
    currentQuestionIndex: room.currentQuestionIndex,
    scores: scores,
    playerCount: scores.length
  });
});

// POST /api/start/:pin -> Teacher starts the quiz
app.post('/api/start/:pin', (req, res) => {
  const pin = req.params.pin;
  if (rooms[pin]) {
    rooms[pin].state = 'playing';
    rooms[pin].currentQuestionIndex = 0;
    console.log(`[START] Room ${pin} quiz started!`);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Room not found' });
});

// POST /api/room/:pin/answer -> Submit answer per question
app.post('/api/room/:pin/answer', (req, res) => {
  const pin = req.params.pin;
  const { name, questionIndex, isCorrect, timeTaken } = req.body;
  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const player = room.players[name];
  if (!player) return res.status(404).json({ error: 'Player not found' });

  // Block duplicate submissions for the same question
  if (player.lastQuestionAnswered === questionIndex) {
    return res.json({ success: true, pointsEarned: 0, totalScore: player.score, duplicate: true });
  }

  // Speed-based score formula using reusable function (1s -> 100, 2s -> 90, 3s -> 80 ... correct min -> 10)
  let pointsEarned = 0;
  if (isCorrect) {
    // Use calculateSpeedScore formula: score = 110 - (seconds * 10), clamped [10, 100]
    const seconds = Math.floor(timeTaken);
    const calculated = 110 - (seconds * 10);
    pointsEarned = Math.max(10, Math.min(100, calculated));
    player.correctCount++;
  }

  player.score = (player.score || 0) + pointsEarned;
  player.timeTaken = (player.timeTaken || 0) + timeTaken;
  player.lastQuestionAnswered = questionIndex;

  const totalQuestions = room.quiz.questions.length;
  if (questionIndex >= totalQuestions - 1) {
    player.finished = true;
    player.finishedAt = Date.now();
  }

  console.log(`[ANSWER] Room ${pin} - "${name}" Q${questionIndex}: ${isCorrect ? 'Correct' : 'Wrong'} in ${timeTaken}s. Points: ${pointsEarned}. Total: ${player.score}`);
  res.json({ success: true, pointsEarned, totalScore: player.score });
});

// POST /api/room/:pin/next -> Host advances quiz step (transitions state: playing -> leaderboard -> playing -> podium)
app.post('/api/room/:pin/next', (req, res) => {
  const pin = req.params.pin;
  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.state === 'playing') {
    room.state = 'leaderboard';
    console.log(`[STATE] Room ${pin} transitioned to leaderboard`);
  } else if (room.state === 'leaderboard') {
    room.currentQuestionIndex++;
    if (room.currentQuestionIndex >= room.quiz.questions.length) {
      room.state = 'podium';
      // Mark all players finished
      Object.keys(room.players).forEach(name => {
        room.players[name].finished = true;
        if (!room.players[name].finishedAt) {
          room.players[name].finishedAt = Date.now();
        }
      });
      console.log(`[STATE] Room ${pin} quiz finished (podium)`);
    } else {
      room.state = 'playing';
      console.log(`[STATE] Room ${pin} advanced to question index ${room.currentQuestionIndex}`);
    }
  }

  res.json({ success: true, state: room.state, currentQuestionIndex: room.currentQuestionIndex });
});

// POST /api/score -> Student finishes quiz and submits final score (backwards compatibility)
app.post('/api/score', (req, res) => {
  const { pin, name, correct, time } = req.body;
  const room = rooms[pin];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.players[name]) {
    // If the student didn't use the per-question API, calculate final stats here
    if (room.players[name].score === 0 && correct > 0) {
      room.players[name].correctCount = correct;
      room.players[name].timeTaken = time;
      room.players[name].score = correct * 70; // fallback standard estimation
    }
    room.players[name].finished = true;
    room.players[name].finishedAt = Date.now();
    console.log(`[SCORE BACKWARD] "${name}" in room ${pin}: ${correct} correct in ${time}s`);
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

let localIp = '127.0.0.1';

// Get local network IP (for dev info only)
try {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const ifaces = networkInterfaces[interfaceName];
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
} catch (e) {
  console.error('Error getting local IP:', e);
}

// GET /api/config -> Returns backend URL info
app.get('/api/config', (req, res) => {
  res.json({
    localIp: `http://${localIp}:${PORT}`
  });
});

// GET /api/health -> Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, rooms: Object.keys(rooms).length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
========================================
 QuizSphere Backend
 Port        : ${PORT}
 Local IP    : http://${localIp}:${PORT}
 Environment : ${process.env.NODE_ENV || 'development'}
 CORS Origin : ${process.env.CORS_ORIGIN || 'all (open)'}
========================================
  `);
});
