// QuizSphere - Application Logic and State Management

// ==========================================
// 1. GLOBAL STATE & USER DATA INITIALIZATION
// ==========================================
const DEFAULT_USER = {
  username: "Guest Challenger",
  email: "",
  loggedIn: false,
  level: 1,
  xp: 0,
  quizzesPlayed: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  streak: 0,
  currentStreak: 0,
  history: [] // Array of { quizId, score, accuracy, timestamp }
};

let userState = { ...DEFAULT_USER };

// Load user from localStorage
function loadUser() {
  const saved = localStorage.getItem('qs_user');
  if (saved) {
    try {
      userState = JSON.parse(saved);
    } catch (e) {
      userState = { ...DEFAULT_USER };
    }
  } else {
    userState = { ...DEFAULT_USER };
  }
  updateUI();
}

function saveUser() {
  localStorage.setItem('qs_user', JSON.stringify(userState));
  updateUI();
}

// Update DOM elements related to user
function updateUI() {
  const guestLinks = document.getElementById('nav-guest-links');
  const userLinks = document.getElementById('nav-user-links');
  const guestCtrl = document.getElementById('auth-guest-ctrl');
  const userCtrl = document.getElementById('auth-user-ctrl');
  
  const userAvatarLbl = document.getElementById('user-avatar-lbl');
  const userNameLbl = document.getElementById('user-name-lbl');
  const userLevelLbl = document.getElementById('user-level-lbl');
  const mobileAuthLbl = document.getElementById('mobile-auth-lbl');

  if (userState.loggedIn) {
    if (guestLinks) guestLinks.classList.add('hidden');
    if (userLinks) userLinks.classList.remove('hidden');
    if (guestCtrl) guestCtrl.classList.add('hidden');
    if (userCtrl) userCtrl.classList.remove('hidden');
    
    if (userNameLbl) userNameLbl.textContent = userState.username;
    if (userAvatarLbl) userAvatarLbl.textContent = userState.username.charAt(0).toUpperCase();
    if (userLevelLbl) userLevelLbl.textContent = `LV ${userState.level}`;
    if (mobileAuthLbl) mobileAuthLbl.textContent = "Profile";
  } else {
    if (guestLinks) guestLinks.classList.remove('hidden');
    if (userLinks) userLinks.classList.add('hidden');
    if (guestCtrl) guestCtrl.classList.remove('hidden');
    if (userCtrl) userCtrl.classList.add('hidden');
    if (mobileAuthLbl) mobileAuthLbl.textContent = "Log In";
  }

  // Update Dashboard stats
  const dashLevel = document.getElementById('dash-stat-level');
  const dashXpRatio = document.getElementById('dash-stat-xp-ratio');
  const dashXpBar = document.getElementById('dash-stat-xp-bar');
  const dashAccuracy = document.getElementById('dash-stat-accuracy');
  const dashQuizzesPlayed = document.getElementById('dash-stat-quizzes-played');

  if (dashLevel) dashLevel.textContent = `Level ${userState.level}`;
  
  // Levels are scaled at 1000 XP per level
  const xpInCurrentLevel = userState.xp % 1000;
  if (dashXpRatio) dashXpRatio.textContent = `${xpInCurrentLevel}/1000 XP`;
  if (dashXpBar) {
    const percent = (xpInCurrentLevel / 1000) * 100;
    dashXpBar.style.width = `${percent}%`;
  }

  const avgAcc = userState.totalQuestions > 0 ? Math.round((userState.totalCorrect / userState.totalQuestions) * 100) : 0;
  if (dashAccuracy) dashAccuracy.textContent = `${avgAcc}%`;
  if (dashQuizzesPlayed) dashQuizzesPlayed.textContent = `${userState.quizzesPlayed} Quizzes played`;
}

// ==========================================
// 2. CLIENT-SIDE ROUTER
// ==========================================
class Router {
  constructor() {
    this.currentView = 'landing';
  }

  navigate(view, params = {}) {
    // Check authentication for protected views
    const protectedViews = ['dashboard', 'creator', 'analytics', 'quiz', 'lobby', 'podium', 'host-control'];
    if (protectedViews.includes(view) && !userState.loggedIn) {
      this.navigate('auth', { mode: 'login' });
      return;
    }

    // Hide active views
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.add('hidden');
    });

    const targetSection = document.getElementById(`view-${view}`);
    if (targetSection) {
      targetSection.classList.remove('hidden');
      this.currentView = view;
      
      // Page specific initialization
      if (view === 'auth') {
        auth.setMode(params.mode || 'login');
      } else if (view === 'dashboard') {
        quizzesDb.renderQuizzes();
      } else if (view === 'analytics') {
        analytics.render();
      } else if (view === 'lobby') {
        lobbyEngine.initLobby(params.pin, params.quizId, params.isHost);
      } else if (view === 'host-control') {
        lobbyEngine.initHostControl(params.pin, params.quizId);
      } else if (view === 'podium') {
        lobbyEngine.renderPodium(params.results, params.pin);
      }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Parallax mouse movements trigger slightly on view change
    const glow1 = document.getElementById('bg-glow-1');
    const glow2 = document.getElementById('bg-glow-2');
    if (glow1 && glow2) {
      const scaleVal = view === 'quiz' ? 'scale(1.2)' : 'scale(1)';
      glow1.style.transform = `translate(${Math.random() * 60 - 30}px, ${Math.random() * 60 - 30}px) ${scaleVal}`;
      glow2.style.transform = `translate(${Math.random() * 60 - 30}px, ${Math.random() * 60 - 30}px) ${scaleVal}`;
    }
  }
}

const router = new Router();
window.router = router;

// ==========================================
// 3. AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================
class AudioSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    // Success double chime: E5 (659Hz) quickly followed by A5 (880Hz)
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880.00, this.ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.35);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playError() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sawtooth';
    // Deep warning buzz: G2 (98Hz) down to F2 (87.3Hz)
    osc.frequency.setValueAtTime(98.00, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(87.31, this.ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;
    // Ascending arpeggio chime C4 (261.6), E4 (329.6), G4 (392.0), C5 (523.3)
    const notes = [261.63, 329.63, 392.00, 523.25];
    const now = this.ctx.currentTime;
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      
      gain.gain.setValueAtTime(0.1, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.1 + 0.25);
      gain.gain.linearRampToValueAtTime(0, now + idx * 0.1 + 0.4);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.4);
    });
  }
}

const audioSynth = new AudioSynth();

// ==========================================
// 4. AUTHENTICATION AND SIMULATOR
// ==========================================
class Auth {
  constructor() {
    this.mode = 'login'; // login or signup
  }

  setMode(mode) {
    this.mode = mode;
    const nameField = document.getElementById('auth-field-name');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleMsg = document.getElementById('auth-toggle-msg');
    const toggleLink = document.getElementById('auth-toggle-link');

    if (mode === 'signup') {
      if (nameField) nameField.style.display = 'block';
      if (authTitle) authTitle.textContent = "Ignite Learning";
      if (authSubtitle) authSubtitle.textContent = "Create an account to start earning XP.";
      if (submitBtn) submitBtn.textContent = "Create Account";
      if (toggleMsg) toggleMsg.textContent = "Already have an account?";
      if (toggleLink) toggleLink.textContent = "Login";
    } else {
      if (nameField) nameField.style.display = 'none';
      if (authTitle) authTitle.textContent = "QuizSphere";
      if (authSubtitle) authSubtitle.textContent = "Step into the arena. Test your knowledge.";
      if (submitBtn) submitBtn.textContent = "Login";
      if (toggleMsg) toggleMsg.textContent = "New to QuizSphere?";
      if (toggleLink) toggleLink.textContent = "Sign up";
    }
  }

  toggleMode() {
    audioSynth.playClick();
    this.setMode(this.mode === 'login' ? 'signup' : 'login');
  }

  togglePasswordVisibility() {
    audioSynth.playClick();
    const pw = document.getElementById('auth-password');
    const icon = document.getElementById('auth-password-vis-icon');
    if (pw) {
      if (pw.type === 'password') {
        pw.type = 'text';
        if (icon) icon.textContent = 'visibility_off';
      } else {
        pw.type = 'password';
        if (icon) icon.textContent = 'visibility';
      }
    }
  }

  handleSubmit(e) {
    e.preventDefault();
    audioSynth.playClick();

    const nameVal = document.getElementById('auth-name').value.trim();
    const emailVal = document.getElementById('auth-email').value.trim();
    const passwordVal = document.getElementById('auth-password').value;

    if (this.mode === 'signup') {
      // Validate Nickname contains only letters, numbers, underscore
      const nameRegex = /^[a-zA-Z0-9_]{3,16}$/;
      if (!nameRegex.test(nameVal)) {
        alert('Nickname must be between 3 to 16 alphanumeric characters (underscores allowed).');
        return;
      }

      userState = {
        ...DEFAULT_USER,
        username: nameVal,
        email: emailVal,
        loggedIn: true
      };
      audioSynth.playSuccess();
      alert(`Welcome, ${nameVal}! Your profile has been initialized.`);
    } else {
      // Simulate Login
      userState = {
        ...DEFAULT_USER,
        username: emailVal.split('@')[0],
        email: emailVal,
        loggedIn: true
      };
      audioSynth.playSuccess();
    }

    saveUser();
    router.navigate('dashboard');
  }

  socialLogin(platform) {
    audioSynth.playClick();
    userState = {
      ...DEFAULT_USER,
      username: `${platform}_Challenger`,
      email: `${platform.toLowerCase()}@quizsphere.com`,
      loggedIn: true
    };
    audioSynth.playSuccess();
    saveUser();
    alert(`Successfully authenticated via ${platform}! Welcome.`);
    router.navigate('dashboard');
  }

  logout() {
    audioSynth.playClick();
    showConfirm(
      'Are you sure you want to log out? Custom quizzes and progress will remain saved locally.',
      () => {
        userState = { ...DEFAULT_USER };
        saveUser();
        router.navigate('landing');
      },
      'Log Out',
      true
    );
  }
}

const auth = new Auth();
window.auth = auth;

// ==========================================
// 5. STANDARD AND CUSTOM QUIZZES DATABASE
// ==========================================
const STANDARD_QUIZZES = [
  {
    id: "tech_mastery",
    title: "Web Dev Mastery",
    category: "Technology",
    timer: 15,
    pin: "111111",
    description: "HTML5 semantic rules, CSS grid structures, and modern JavaScript arrays.",
    questions: [
      {
        q: "Which HTML5 element is used to display independent, self-contained content?",
        options: ["<section>", "<article>", "<aside>", "<nav>"],
        correct: 1
      },
      {
        q: "Which CSS display property values establish a modern grid layout system?",
        options: ["grid", "flex-grid", "table-layout", "layout-grid"],
        correct: 0
      },
      {
        q: "Which JS Array function returns the first element matching a filter function?",
        options: ["map()", "filter()", "find()", "some()"],
        correct: 2
      },
      {
        q: "Which HTML attribute specifies that an input field must be filled out before submitting?",
        options: ["required", "validate", "placeholder", "autofocus"],
        correct: 0
      },
      {
        q: "In Web development, what does the acronym 'API' stand for?",
        options: ["Automated Process Interface", "Application Programming Interface", "Active Portal Information", "Analytical Protocol Integration"],
        correct: 1
      }
    ]
  },
  {
    id: "cosmology_space",
    title: "Cosmology & Space",
    category: "Science",
    timer: 15,
    pin: "222222",
    description: "Test your understanding of stellar evolutions, galaxies, and orbits.",
    questions: [
      {
        q: "Approximately how long does it take for light from the Sun to reach Earth?",
        options: ["8 seconds", "8 minutes", "8 hours", "8 days"],
        correct: 1
      },
      {
        q: "Which stellar event produces a massive shockwave, resulting in a black hole or neutron star?",
        options: ["Protostar ignition", "Red Giant cooling", "Supernova explosion", "Planetary nebula expansion"],
        correct: 2
      },
      {
        q: "What is the name of the nearest spiral galaxy to our own Milky Way?",
        options: ["Andromeda Galaxy", "Triangulum Galaxy", "Large Magellanic Cloud", "Sombrero Galaxy"],
        correct: 0
      },
      {
        q: "Which planet in our solar system has the most prominent ring system?",
        options: ["Jupiter", "Uranus", "Neptune", "Saturn"],
        correct: 3
      },
      {
        q: "Who was the first human to orbit the Earth in space (1961)?",
        options: ["Neil Armstrong", "Yuri Gagarin", "Buzz Aldrin", "John Glenn"],
        correct: 1
      }
    ]
  },
  {
    id: "world_history",
    title: "World History Arena",
    category: "History",
    timer: 20,
    pin: "333333",
    description: "Explore the ancient civilizations, declarations, and alliances.",
    questions: [
      {
        q: "Which ancient civilization constructed the massive Pyramids of Giza?",
        options: ["Mesopotamians", "Egyptians", "Romans", "Aztecs"],
        correct: 1
      },
      {
        q: "In which year did the United States sign the Declaration of Independence?",
        options: ["1776", "1789", "1812", "1750"],
        correct: 0
      },
      {
        q: "Who was the legendary commander and Emperor of the French in the early 19th century?",
        options: ["Louis XIV", "Charles de Gaulle", "Napoleon Bonaparte", "Robespierre"],
        correct: 2
      },
      {
        q: "Which wall was constructed in Europe in 1961 and fell in 1989, symbolizing the Cold War?",
        options: ["The Great Wall", "Hadrian's Wall", "The Berlin Wall", "The Western Wall"],
        correct: 2
      },
      {
        q: "Which empire was ruled by Genghis Khan in the 13th century?",
        options: ["Mongol Empire", "Ottoman Empire", "Roman Empire", "Persian Empire"],
        correct: 0
      }
    ]
  }
];

class QuizzesDatabase {
  constructor() {
    this.customQuizzes = [];
  }

  loadCustomQuizzes() {
    const saved = localStorage.getItem('qs_custom_quizzes');
    if (saved) {
      try {
        this.customQuizzes = JSON.parse(saved);
      } catch (e) {
        this.customQuizzes = [];
      }
    } else {
      this.customQuizzes = [];
    }
  }

  saveCustomQuiz(quiz) {
    this.customQuizzes.push(quiz);
    localStorage.setItem('qs_custom_quizzes', JSON.stringify(this.customQuizzes));
    this.renderQuizzes();
  }

  getQuizById(id) {
    const std = STANDARD_QUIZZES.find(q => q.id === id);
    if (std) return std;
    return this.customQuizzes.find(q => q.id === id);
  }

  deleteCustomQuiz(id) {
    audioSynth.playClick();
    showConfirm(
      'Are you sure you want to delete this custom quiz? This action cannot be undone.',
      () => {
        const quiz = this.customQuizzes.find(q => q.id === id);
        this.customQuizzes = this.customQuizzes.filter(q => q.id !== id);
        localStorage.setItem('qs_custom_quizzes', JSON.stringify(this.customQuizzes));
        this.renderQuizzes();

        // If the quiz has a PIN, delete it from the server too
        if (quiz && quiz.pin) {
          const apiBase = (localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
          fetch(`${apiBase}/api/room/${quiz.pin}`, { method: 'DELETE' })
            .catch(err => console.log('Quiz room not active or failed to delete on server', err));
        }
      },
      'Delete',
      true
    );
  }

  renderQuizzes() {
    this.loadCustomQuizzes();
    
    const standardGrid = document.getElementById('standard-quiz-grid');
    const customGrid = document.getElementById('custom-quiz-grid');

    if (standardGrid) {
      standardGrid.innerHTML = '';
      STANDARD_QUIZZES.forEach(quiz => {
        standardGrid.appendChild(this.createQuizCard(quiz));
      });
    }

    if (customGrid) {
      customGrid.innerHTML = '';
      if (this.customQuizzes.length === 0) {
        customGrid.innerHTML = `
          <div class="col-span-2 text-center py-10 border border-dashed border-white/10 rounded-2xl">
            <p class="text-xs text-on-surface-variant italic">No custom quizzes created yet. Head to Creator Studio to build your first quiz!</p>
          </div>
        `;
      } else {
        this.customQuizzes.forEach(quiz => {
          customGrid.appendChild(this.createQuizCard(quiz, true));
        });
      }
    }

    // Render simulated leaderboard list
    const leaderboardList = document.getElementById('leaderboard-list');
    if (leaderboardList) {
      leaderboardList.innerHTML = '';
      
      const mockLeaderboard = [
        { name: "Elena Rodriguez", xp: 15400, tier: "Master" },
        { name: "Marcus Thorne", xp: 14200, tier: "Pro" },
        { name: "Sarah Chen", xp: 13800, tier: "Pro" },
        { name: userState.username, xp: userState.xp, tier: userState.level >= 5 ? "Pro" : "Initiate", isUser: true },
        { name: "Alex Mercer", xp: 1100, tier: "Initiate" }
      ];

      // Sort by XP
      mockLeaderboard.sort((a, b) => b.xp - a.xp);

      mockLeaderboard.forEach((player, idx) => {
        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-3 rounded-xl border ${player.isUser ? 'bg-primary/10 border-primary/40' : 'bg-white/5 border-white/5'}`;
        
        let rankColor = 'text-on-surface-variant';
        if (idx === 0) rankColor = 'text-yellow-400 font-bold';
        else if (idx === 1) rankColor = 'text-slate-300 font-bold';
        else if (idx === 2) rankColor = 'text-amber-600 font-bold';

        item.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold ${rankColor}">#${idx + 1}</span>
            <span class="text-xs font-bold ${player.isUser ? 'text-primary' : 'text-on-surface'}">${player.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9px] uppercase tracking-wider bg-white/10 px-1.5 py-0.5 rounded text-on-surface-variant">${player.tier}</span>
            <span class="text-xs font-bold text-on-surface">${player.xp} XP</span>
          </div>
        `;
        leaderboardList.appendChild(item);
      });
    }
  }

  createQuizCard(quiz, isCustom = false) {
    const card = document.createElement('div');
    card.className = `glass-card-interactive p-6 rounded-2xl flex flex-col justify-between h-full border ${isCustom ? 'border-secondary/20' : 'border-white/10'}`;
    
    const pinBadge = quiz.pin ? `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-secondary/15 text-secondary border border-secondary/30 uppercase tracking-wider font-mono">PIN: ${quiz.pin}</span>` : '';
    
    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-3">
          <div class="flex gap-2 items-center">
            <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-white/10 ${quiz.category === 'Technology' ? 'text-primary' : quiz.category === 'Science' ? 'text-secondary' : 'text-tertiary'}">${quiz.category}</span>
            ${pinBadge}
          </div>
          <span class="text-[10px] text-on-surface-variant font-label-md flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">timer</span>
            ${quiz.timer}s / Q
          </span>
        </div>
        <h4 class="text-on-surface font-bold text-headline-md mb-2 leading-tight">${quiz.title}</h4>
        <p class="text-xs text-on-surface-variant leading-relaxed mb-4">${quiz.description || `Custom ${quiz.category} quiz containing ${quiz.questions.length} questions.`}</p>
      </div>
      <div class="flex items-center justify-between mt-4 border-t border-white/5 pt-4">
        <span class="text-[10px] text-on-surface-variant uppercase font-bold">${quiz.questions.length} Questions</span>
        <div class="flex gap-2">
          ${isCustom ? `
          <button onclick="quizzesDb.deleteCustomQuiz('${quiz.id}')" class="px-3 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl font-bold text-xs flex items-center gap-1 transition-all duration-200">
            <span class="material-symbols-outlined text-sm">delete</span>
            Delete
          </button>
          ` : ''}
          <button onclick="lobbyEngine.host('${quiz.id}')" class="px-3 py-2 border border-white/10 rounded-xl text-on-surface-variant hover:bg-white/5 font-bold text-xs flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">groups</span>
            Host
          </button>
          <button onclick="quizEngine.start('${quiz.id}')" class="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-xs rounded-xl shadow-md active:scale-95 duration-200">
            Play
          </button>
        </div>
      </div>
    `;
    return card;
  }
}

const quizzesDb = new QuizzesDatabase();
window.quizzesDb = quizzesDb;

// ==========================================
// 6. INTERACTIVE QUIZ ENGINE
// ==========================================
class QuizEngine {
  constructor() {
    this.activeQuiz = null;
    this.currentQIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.answers = []; // Array of boolean responses
    this.timeLeft = 15;
    this.timerInterval = null;
    this.canAnswer = true;
    this.activeRoomPin = null; // To track if this is a real backend multiplayer session
  }

  startWithData(quizData) {
    audioSynth.playClick();
    this.activeQuiz = quizData;
    if (!this.activeQuiz || this.activeQuiz.questions.length === 0) {
      alert('Quiz not found or has no questions.');
      return;
    }
    this._initQuizState();
  }

  start(quizId) {
    audioSynth.playClick();
    this.activeQuiz = quizzesDb.getQuizById(quizId);
    if (!this.activeQuiz || this.activeQuiz.questions.length === 0) {
      alert('Quiz not found or has no questions.');
      return;
    }
    this._initQuizState();
  }

  _initQuizState() {

    this.currentQIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.answers = [];
    this.canAnswer = true;
    this.totalTimeTaken = 0;

    // Transition to quiz view
    router.navigate('quiz');
    
    // Set headers
    document.getElementById('quiz-run-title').textContent = this.activeQuiz.title;
    
    this.loadQuestion();
  }

  loadQuestion() {
    this.canAnswer = true;
    const question = this.activeQuiz.questions[this.currentQIndex];
    
    // Update Question Info
    document.getElementById('quiz-run-q-index').textContent = `Question ${this.currentQIndex + 1} of ${this.activeQuiz.questions.length}`;
    document.getElementById('quiz-run-question-text').textContent = question.q;
    
    // Update Progress bar
    const progressPercent = ((this.currentQIndex) / this.activeQuiz.questions.length) * 100;
    document.getElementById('quiz-run-progress-bar').style.width = `${progressPercent}%`;

    // Hide Next Button
    document.getElementById('quiz-run-next-btn').classList.add('hidden');

    // Load options
    const optionsGrid = document.getElementById('quiz-run-options-grid');
    optionsGrid.innerHTML = '';

    question.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = "w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 text-on-surface hover:bg-white/10 hover:border-white/20 transition-all font-body-sm flex justify-between items-center";
      btn.innerHTML = `
        <span>${opt}</span>
        <span class="material-symbols-outlined text-sm opacity-0" id="opt-icon-${idx}">circle</span>
      `;
      btn.onclick = () => this.selectOption(idx);
      optionsGrid.appendChild(btn);
    });

    // Start timer countdown
    this.timeLeft = this.activeQuiz.timer;
    document.getElementById('quiz-run-timer').textContent = this.timeLeft;
    
    // Reset timer circle stroke
    const circle = document.getElementById('quiz-timer-svg-circle');
    if (circle) circle.style.strokeDashoffset = '0';
    
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tick(), 1000);
    this.qStartTime = performance.now();
  }

  tick() {
    this.timeLeft--;
    const timerLbl = document.getElementById('quiz-run-timer');
    if (timerLbl) timerLbl.textContent = this.timeLeft;

    // Animate radial clock
    const circle = document.getElementById('quiz-timer-svg-circle');
    if (circle) {
      const fraction = this.timeLeft / this.activeQuiz.timer;
      const offset = 163.36 * (1 - fraction);
      circle.style.strokeDashoffset = offset;
    }

    if (this.timeLeft <= 0) {
      clearInterval(this.timerInterval);
      this.timeOut();
    }
  }

  selectOption(idx) {
    if (!this.canAnswer) return;
    this.canAnswer = false;
    clearInterval(this.timerInterval);

    const timeElapsed = (performance.now() - this.qStartTime) / 1000;
    this.totalTimeTaken += timeElapsed;

    const question = this.activeQuiz.questions[this.currentQIndex];
    const isCorrect = idx === question.correct;
    
    this.answers.push(isCorrect);
    
    const optionsGrid = document.getElementById('quiz-run-options-grid');
    const buttons = optionsGrid.querySelectorAll('button');

    if (isCorrect) {
      this.score += 100;
      this.correctCount++;
      audioSynth.playSuccess();
      buttons[idx].classList.remove('bg-white/5', 'border-white/10');
      buttons[idx].classList.add('bg-green-500/20', 'border-green-500/50', 'text-green-300');
      const icon = document.getElementById(`opt-icon-${idx}`);
      if (icon) {
        icon.textContent = 'check_circle';
        icon.classList.remove('opacity-0');
        icon.classList.add('text-green-400');
      }
    } else {
      audioSynth.playError();
      buttons[idx].classList.remove('bg-white/5', 'border-white/10');
      buttons[idx].classList.add('bg-red-500/20', 'border-red-500/50', 'text-red-300');
      const icon = document.getElementById(`opt-icon-${idx}`);
      if (icon) {
        icon.textContent = 'cancel';
        icon.classList.remove('opacity-0');
        icon.classList.add('text-red-400');
      }

      // Highlight the correct option
      const correctIdx = question.correct;
      buttons[correctIdx].classList.remove('bg-white/5', 'border-white/10');
      buttons[correctIdx].classList.add('bg-green-500/10', 'border-green-500/40', 'text-green-300');
      const correctIcon = document.getElementById(`opt-icon-${correctIdx}`);
      if (correctIcon) {
        correctIcon.textContent = 'check_circle';
        correctIcon.classList.remove('opacity-0');
        correctIcon.classList.add('text-green-400');
      }
    }

    document.getElementById('quiz-run-next-btn').classList.remove('hidden');
  }

  timeOut() {
    this.canAnswer = false;
    this.answers.push(false);
    audioSynth.playError();

    const timeElapsed = this.activeQuiz.timer;
    this.totalTimeTaken += timeElapsed;

    const question = this.activeQuiz.questions[this.currentQIndex];
    const optionsGrid = document.getElementById('quiz-run-options-grid');
    const buttons = optionsGrid.querySelectorAll('button');

    // Highlight the correct option
    const correctIdx = question.correct;
    buttons[correctIdx].classList.add('bg-green-500/10', 'border-green-500/40', 'text-green-300');
    const correctIcon = document.getElementById(`opt-icon-${correctIdx}`);
    if (correctIcon) {
      correctIcon.textContent = 'check_circle';
      correctIcon.classList.remove('opacity-0');
      correctIcon.classList.add('text-green-400');
    }

    // Flash timer warning
    document.getElementById('quiz-run-timer').textContent = "!";
    
    document.getElementById('quiz-run-next-btn').classList.remove('hidden');
  }

  nextQuestion() {
    audioSynth.playClick();
    this.currentQIndex++;
    if (this.currentQIndex >= this.activeQuiz.questions.length) {
      this.finish();
    } else {
      this.loadQuestion();
    }
  }

  finish() {
    clearInterval(this.timerInterval);
    audioSynth.playFanfare();

    // Accuracy calculations
    const accuracy = Math.round((this.correctCount / this.activeQuiz.questions.length) * 100);
    
    // Update User Profile Stats
    userState.quizzesPlayed++;
    userState.totalCorrect += this.correctCount;
    userState.totalQuestions += this.activeQuiz.questions.length;
    
    // Streak math
    let currentStreakCount = userState.currentStreak;
    this.answers.forEach(ans => {
      if (ans) {
        currentStreakCount++;
      } else {
        if (currentStreakCount > userState.streak) {
          userState.streak = currentStreakCount;
        }
        currentStreakCount = 0;
      }
    });
    userState.currentStreak = currentStreakCount;
    if (userState.currentStreak > userState.streak) {
      userState.streak = userState.currentStreak;
    }

    // Add score to XP (e.g. 100 XP per correct question + 100 completion bonus)
    const xpEarned = (this.correctCount * 100) + 100;
    userState.xp += xpEarned;
    
    // Levels trigger at every 1000 XP threshold
    const newLevel = Math.floor(userState.xp / 1000) + 1;
    if (newLevel > userState.level) {
      userState.level = newLevel;
      setTimeout(() => alert(`🎉 LEVEL UP! You reached Level ${newLevel}!`), 500);
    }

    // Push into history
    userState.history.push({
      quizId: this.activeQuiz.id,
      quizTitle: this.activeQuiz.title,
      score: xpEarned,
      accuracy: accuracy,
      timestamp: Date.now(),
      category: this.activeQuiz.category,
      answersHistory: this.answers // saved for streak/analytics
    });

    saveUser();

    // 1. If this is a real backend multiplayer game
    if (this.activeRoomPin) {
      const pin = this.activeRoomPin;
      const apiBase = (this.activeApiBase || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
      fetch(`${apiBase}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pin,
          name: this.activePlayerName || userState.username,
          correct: this.correctCount,
          time: parseFloat(this.totalTimeTaken.toFixed(2))
        })
      })
      .then(() => {
        this.activeRoomPin = null;
        this.activePlayerName = null;
        this.activeApiBase = null;
        router.navigate('podium', { pin: pin });
      })
      .catch(err => {
        console.error("Failed to sync score to backend", err);
        this.activeRoomPin = null;
        this.activePlayerName = null;
        this.activeApiBase = null;
        router.navigate('podium', { pin: pin });
      });
      return;
    }

    // Populate Results Overlay
    document.getElementById('results-score').textContent = `+${xpEarned} XP`;
    document.getElementById('results-acc').textContent = `${accuracy}%`;
    document.getElementById('results-status').textContent = accuracy >= 80 ? "Gold" : accuracy >= 50 ? "Silver" : "Bronze";

    // Setup review checklist
    const breakdownList = document.getElementById('results-breakdown-list');
    breakdownList.innerHTML = '';
    this.activeQuiz.questions.forEach((q, idx) => {
      const isCorrect = this.answers[idx];
      const div = document.createElement('div');
      div.className = `flex justify-between items-center text-xs py-2 border-b border-white/5`;
      div.innerHTML = `
        <span class="text-on-surface-variant truncate mr-4 max-w-[280px]">${q.q}</span>
        <span class="font-bold shrink-0 ${isCorrect ? 'text-green-400' : 'text-red-400'}">${isCorrect ? 'Correct' : 'Incorrect'}</span>
      `;
      breakdownList.appendChild(div);
    });

    // Display overlay
    document.getElementById('quiz-results-container').classList.remove('hidden');

    // Trigger canvas celebration
    this.drawConfetti();
  }

  drawConfetti() {
    const canvas = document.getElementById('quiz-results-confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const particles = [];
    const colors = ['#d0bcff', '#4cd7f6', '#ffb0cd', '#e9ddff', '#acedff'];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 5 + 3,
        d: Math.random() * canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
      });
    }

    let animationId;
    function updateConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach(p => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 10;

        if (p.y <= canvas.height) {
          active = true;
        }

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      if (active) {
        animationId = requestAnimationFrame(updateConfetti);
      }
    }

    updateConfetti();

    // Stop animations once modal exits
    this.resultsAnimationId = animationId;
  }

  exit() {
    audioSynth.playClick();
    clearInterval(this.timerInterval);
    document.getElementById('quiz-results-container').classList.add('hidden');
    
    const canvas = document.getElementById('quiz-results-confetti');
    if (canvas && this.resultsAnimationId) {
      cancelAnimationFrame(this.resultsAnimationId);
    }
    
    router.navigate('dashboard');
  }

  replay() {
    audioSynth.playClick();
    document.getElementById('quiz-results-container').classList.add('hidden');
    
    const canvas = document.getElementById('quiz-results-confetti');
    if (canvas && this.resultsAnimationId) {
      cancelAnimationFrame(this.resultsAnimationId);
    }
    
    this.start(this.activeQuiz.id);
  }
}

const quizEngine = new QuizEngine();
window.quizEngine = quizEngine;

// ==========================================
// 6.5. SPEED SCORING UTILITY
// ==========================================
function calculateSpeedScore(timeTaken) {
  const seconds = Math.floor(timeTaken);
  const score = 110 - (seconds * 10);
  return Math.max(10, Math.min(100, score));
}
window.calculateSpeedScore = calculateSpeedScore;

// ==========================================
// 7. CREATOR STUDIO PANEL
// ==========================================
class CreatorStudio {
  constructor() {
    this.questions = [];
    this.syncInterval = null;
    this.currentTab = 'manual';
  }

  setTab(tabName) {
    audioSynth.playClick();
    this.currentTab = tabName;
    
    const manualBtn = document.getElementById('creator-tab-manual');
    const excelBtn = document.getElementById('creator-tab-excel');
    const manualPanel = document.getElementById('creator-manual-panel');
    const excelPanel = document.getElementById('creator-excel-panel');
    
    if (tabName === 'manual') {
      if (manualBtn) {
        manualBtn.className = 'px-4 py-2 bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-xs rounded-xl shadow-md';
      }
      if (excelBtn) {
        excelBtn.className = 'px-4 py-2 border border-white/10 text-on-surface-variant hover:bg-white/5 font-bold text-xs rounded-xl';
      }
      if (manualPanel) manualPanel.classList.remove('hidden');
      if (excelPanel) excelPanel.classList.add('hidden');
    } else {
      if (manualBtn) {
        manualBtn.className = 'px-4 py-2 border border-white/10 text-on-surface-variant hover:bg-white/5 font-bold text-xs rounded-xl';
      }
      if (excelBtn) {
        excelBtn.className = 'px-4 py-2 bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-xs rounded-xl shadow-md';
      }
      if (manualPanel) manualPanel.classList.add('hidden');
      if (excelPanel) excelPanel.classList.remove('hidden');
    }
  }

  handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const errorEl = document.getElementById('excel-error-msg');
    const successEl = document.getElementById('excel-success-msg');
    
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    // Check file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      if (errorEl) {
        errorEl.textContent = '❌ Only .xlsx and .xls files are supported.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Use SheetJS library (already added to HTML via CDN)
    if (typeof XLSX === 'undefined') {
      if (errorEl) {
        errorEl.textContent = '❌ SheetJS library not loaded. Please refresh the page.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        // Validate and parse questions
        const parsedQuestions = [];
        const errors = [];

        jsonData.forEach((row, rowIdx) => {
          const q = row.Question ? row.Question.trim() : '';
          const optA = row['Option A'] ? row['Option A'].trim() : '';
          const optB = row['Option B'] ? row['Option B'].trim() : '';
          const optC = row['Option C'] ? row['Option C'].trim() : '';
          const optD = row['Option D'] ? row['Option D'].trim() : '';
          const correctAnswer = row['Correct Answer'] ? row['Correct Answer'].trim().toUpperCase() : '';
          const timerStr = row.Timer ? String(row.Timer).trim() : '15';

          // Validation checks
          if (!q) {
            errors.push(`Row ${rowIdx + 2}: Question is empty`);
            return;
          }
          if (!optA || !optB || !optC || !optD) {
            errors.push(`Row ${rowIdx + 2}: One or more options are empty`);
            return;
          }
          if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
            errors.push(`Row ${rowIdx + 2}: Correct Answer must be A, B, C, or D (found: "${correctAnswer}")`);
            return;
          }

          // Validate correct answer matches an option
          const correctIdx = { A: 0, B: 1, C: 2, D: 3 }[correctAnswer];
          const options = [optA, optB, optC, optD];
          // Note: Validation allows any option as correct; user must ensure accuracy

          const timer = parseInt(timerStr);
          if (isNaN(timer) || timer < 10 || timer > 30) {
            errors.push(`Row ${rowIdx + 2}: Timer must be between 10-30 seconds (found: ${timerStr})`);
            return;
          }

          parsedQuestions.push({
            q: q,
            options: options,
            correct: correctIdx,
            timer: timer
          });
        });

        if (errors.length > 0) {
          if (errorEl) {
            errorEl.innerHTML = `<strong>Validation Errors:</strong><br>${errors.map(e => `• ${e}`).join('<br>')}`;
            errorEl.classList.remove('hidden');
          }
          return;
        }

        if (parsedQuestions.length === 0) {
          if (errorEl) {
            errorEl.textContent = '❌ No valid questions found in the Excel file.';
            errorEl.classList.remove('hidden');
          }
          return;
        }

        // Success: merge questions into the builder
        this.questions = parsedQuestions;
        this.renderQuestionsList();

        if (successEl) {
          successEl.innerHTML = `✅ Successfully imported <strong>${parsedQuestions.length}</strong> questions! Review them below and click "Publish Quiz" to save.`;
          successEl.classList.remove('hidden');
        }

        // Reset file input
        event.target.value = '';
      } catch (err) {
        console.error('Excel parse error:', err);
        if (errorEl) {
          errorEl.textContent = `❌ Error reading Excel file: ${err.message}`;
          errorEl.classList.remove('hidden');
        }
      }
    };

    reader.readAsArrayBuffer(file);
  }

  reset() {
    audioSynth.playClick();
    this.questions = [];
    document.getElementById('create-title').value = '';
    document.getElementById('create-category').value = 'Technology';
    
    const pinEl = document.getElementById('create-pin');
    if (pinEl) {
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      pinEl.value = newPin;
      this.showQrForPin(newPin);
    }
    
    // Clear forms
    document.getElementById('create-q-text').value = '';
    document.getElementById('create-opt-a').value = '';
    document.getElementById('create-opt-b').value = '';
    document.getElementById('create-opt-c').value = '';
    document.getElementById('create-opt-d').value = '';
    
    // Reset tab to manual
    this.setTab('manual');
    
    // Clear Excel messages
    const errorEl = document.getElementById('excel-error-msg');
    const successEl = document.getElementById('excel-success-msg');
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');
    
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.value = '';
    
    this.renderQuestionsList();
  }

  hostLiveQuiz() {
    audioSynth.playClick();
    const title = document.getElementById('create-title').value.trim() || 'My Live Quiz';
    const cat = document.getElementById('create-category').value;
    
    if (this.questions.length === 0) {
      alert("Please add at least one question before hosting a live quiz.");
      return;
    }

    const quizData = {
      title: title,
      category: cat,
      questions: this.questions,
      timer: 15
    };

    fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: quizData })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const pinEl = document.getElementById('create-pin');
        if (pinEl) pinEl.value = data.pin;
        this.showQrForPin(data.pin);
      }
    })
    .catch(err => {
      console.error(err);
      alert("Error contacting the backend server. Is server.js running?");
    });
  }

  setPublicUrl() {
    const input = document.getElementById('create-public-url-input');
    if (!input) return;
    let url = input.value.trim().replace(/\/$/, '');
    if (!url) { alert('Please paste your tunnel URL first.'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;
    localStorage.setItem('qs_public_url', url);
    
    // Regenerate QR with new URL
    const pinEl = document.getElementById('create-pin');
    if (pinEl && pinEl.value) {
      this.showQrForPin(pinEl.value);
    }
    audioSynth.playSuccess();
  }

  // Called whenever the PIN input changes
  onPinInput() {
    const pinEl = document.getElementById('create-pin');
    if (pinEl && /^\d{6}$/.test(pinEl.value)) {
      this.showQrForPin(pinEl.value);
    } else {
      // Hide QR panel if PIN is incomplete
      const panel = document.getElementById('create-qr-panel');
      if (panel) panel.classList.add('hidden');
    }
  }

  // Show the QR code panel with the given 6-digit PIN
  showQrForPin(pin) {
    if (!pin || !/^\d{6}$/.test(pin)) return;

    // Use saved public URL or fall back to current origin
    const baseUrl = (localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
    const shareUrl = `${baseUrl}?pin=${pin}`;

    // Update QR image using free API
    const qrImg = document.getElementById('create-qr-img');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0b1326&bgcolor=ffffff&data=${encodeURIComponent(shareUrl)}`;
    }

    // Update share URL input
    const shareInput = document.getElementById('create-share-url');
    if (shareInput) shareInput.value = shareUrl;

    // Update PIN display
    const pinDisplay = document.getElementById('create-qr-pin-display');
    if (pinDisplay) pinDisplay.textContent = pin;

    // Pre-fill URL input
    const urlInput = document.getElementById('create-public-url-input');
    if (urlInput) urlInput.value = localStorage.getItem('qs_public_url') || '';

    // Show the panel
    const panel = document.getElementById('create-qr-panel');
    if (panel) panel.classList.remove('hidden');

    // Start live leaderboard sync
    this.startLeaderboardSync(pin);
  }

  startLeaderboardSync(pin) {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.fetchLeaderboard(pin);
    this.syncInterval = setInterval(() => this.fetchLeaderboard(pin), 3000);
  }

  stopLeaderboardSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  fetchLeaderboard(pin) {
    // Teacher is on their computer so /api/room is always relative to localhost:8080
    fetch(`/api/room/${pin}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) return;

        const board = document.getElementById('create-live-leaderboard');
        const statusEl = document.getElementById('creator-lobby-status');
        const startBtn = document.getElementById('creator-start-live-btn');
        if (!board) return;
        
        if (data.state === 'waiting') {
           if (statusEl) statusEl.textContent = 'Waiting for students...';
           if (startBtn) {
             startBtn.classList.remove('hidden');
             startBtn.disabled = (!data.scores || data.scores.length === 0);
           }
        } else {
           if (statusEl) statusEl.textContent = 'Quiz in Progress!';
           if (startBtn) startBtn.classList.add('hidden');
        }

        if (!data.scores || data.scores.length === 0) {
          board.innerHTML = '<p class="text-xs text-on-surface-variant italic text-center py-4">Waiting for students to join...</p>';
          return;
        }

        board.innerHTML = '';
        data.scores.forEach((s, idx) => {
          const row = document.createElement('div');
          
          if (data.state === 'waiting') {
            // In waiting room, show name + email
            row.className = `flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5 text-xs text-on-surface`;
            row.innerHTML = `
              <span class="font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                <span>
                  <span class="text-on-surface">${s.name}</span>
                  ${s.email ? `<span class="text-on-surface-variant ml-1">(${s.email})</span>` : ''}
                </span>
              </span>
              <span class="text-green-400 font-bold">✓ Joined</span>`;
          } else {
            // Live leaderboard
            let rankBadge = `text-on-surface-variant`;
            if (idx === 0) rankBadge = `text-yellow-400 font-bold`;
            else if (idx === 1) rankBadge = `text-slate-300 font-bold`;
            else if (idx === 2) rankBadge = `text-amber-600 font-bold`;

            row.className = `flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5 text-xs text-on-surface`;
            row.innerHTML = `
              <div class="flex items-center gap-3">
                <span class="w-5 text-center font-bold ${rankBadge}">#${idx + 1}</span>
                <span class="font-bold truncate max-w-[200px]">${s.name} ${s.finished ? '✅' : '⏳'}</span>
              </div>
              <div class="flex items-center gap-6">
                <span class="text-on-surface-variant font-label-md">${s.correct} Correct</span>
                <span class="font-mono font-bold text-secondary">${s.time}s</span>
              </div>
            `;
          }
          board.appendChild(row);
        });
      })
      .catch(err => console.error("Leaderboard sync error", err));
  }

  startLiveQuizForAll() {
    audioSynth.playClick();
    const pinEl = document.getElementById('create-pin');
    if (!pinEl || !pinEl.value) return;

    fetch(`/api/start/${pinEl.value}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const statusEl = document.getElementById('creator-lobby-status');
          if (statusEl) statusEl.textContent = 'Quiz in Progress!';
          const startBtn = document.getElementById('creator-start-live-btn');
          if (startBtn) startBtn.classList.add('hidden');
        }
      });
  }

  clearLeaderboard() {
    const pinEl = document.getElementById('create-pin');
    if (!pinEl || !pinEl.value) return;
    showConfirm(
      'Clear all students from the lobby? You will need to host a new quiz.',
      () => {
        fetch(`/api/room/${pinEl.value}`, { method: 'DELETE' })
          .then(() => {
            this.stopLeaderboardSync();
            pinEl.value = '';
            const panel = document.getElementById('create-qr-panel');
            if (panel) panel.classList.add('hidden');
            const board = document.getElementById('create-live-leaderboard');
            if (board) board.innerHTML = '<p class="text-xs text-on-surface-variant italic text-center py-4">Waiting for students to join...</p>';
            alert('Lobby cleared. Click "Host Live Quiz" to start a new session.');
          })
          .catch(() => alert('Could not clear lobby.'));
      },
      'Clear Lobby',
      true
    );
  }

  // Copy the share URL to clipboard
  copyShareUrl() {
    const shareInput = document.getElementById('create-share-url');
    if (!shareInput) return;
    navigator.clipboard.writeText(shareInput.value).then(() => {
      audioSynth.playSuccess();
      const btn = document.querySelector('button[onclick="creatorStudio.copyShareUrl()"]');
      if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = 'Copy Link', 2000); }
    }).catch(() => {
      shareInput.select();
      document.execCommand('copy');
    });
  }

  addQuestion() {
    audioSynth.playClick();
    
    const qText = document.getElementById('create-q-text').value.trim();
    const optA = document.getElementById('create-opt-a').value.trim();
    const optB = document.getElementById('create-opt-b').value.trim();
    const optC = document.getElementById('create-opt-c').value.trim();
    const optD = document.getElementById('create-opt-d').value.trim();
    const correctOpt = document.getElementById('create-correct-opt').value;
    const timerSeconds = parseInt(document.getElementById('create-timer').value);

    if (!qText || !optA || !optB || !optC || !optD) {
      alert('Please fill out the question prompt and all 4 option slots.');
      return;
    }

    const mapping = { A: 0, B: 1, C: 2, D: 3 };

    this.questions.push({
      q: qText,
      options: [optA, optB, optC, optD],
      correct: mapping[correctOpt]
    });

    // Reset prompt fields
    document.getElementById('create-q-text').value = '';
    document.getElementById('create-opt-a').value = '';
    document.getElementById('create-opt-b').value = '';
    document.getElementById('create-opt-c').value = '';
    document.getElementById('create-opt-d').value = '';

    this.renderQuestionsList();
    audioSynth.playSuccess();
  }

  removeQuestion(idx) {
    audioSynth.playClick();
    this.questions.splice(idx, 1);
    this.renderQuestionsList();
  }

  renderQuestionsList() {
    const list = document.getElementById('create-questions-container');
    const label = document.getElementById('create-q-count');

    if (label) label.textContent = `Total: ${this.questions.length} questions added`;
    if (!list) return;

    list.innerHTML = '';
    if (this.questions.length === 0) {
      list.innerHTML = `
        <p id="create-empty-questions-msg" class="text-xs text-on-surface-variant py-8 text-center italic border border-dashed border-white/10 rounded-2xl">
          No questions added yet. Use the tool below to define a question card.
        </p>
      `;
      return;
    }

    this.questions.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = "flex justify-between items-center p-3.5 bg-white/5 border border-white/10 rounded-xl mb-2 text-xs";
      item.innerHTML = `
        <div class="truncate max-w-[500px]">
          <span class="font-bold text-primary mr-2">Q${idx + 1}.</span>
          <span class="text-on-surface">${q.q}</span>
        </div>
        <button onclick="creatorStudio.removeQuestion(${idx})" class="text-red-400 hover:text-red-500 shrink-0 ml-4 font-bold uppercase tracking-wider text-[10px]">
          Delete
        </button>
      `;
      list.appendChild(item);
    });
  }

  saveQuiz() {
    audioSynth.playClick();
    
    const titleVal = document.getElementById('create-title').value.trim();
    const catVal = document.getElementById('create-category').value;
    const timerSeconds = parseInt(document.getElementById('create-timer').value);
    
    const pinEl = document.getElementById('create-pin');
    const pinVal = pinEl ? pinEl.value.trim().replace(/\s/g, '') : '';

    if (!titleVal) {
      alert('Please enter a Title for your custom quiz.');
      return;
    }

    if (!/^\d{6}$/.test(pinVal)) {
      alert('Game PIN must be a 6-digit number.');
      return;
    }

    // Check if duplicate PIN exists in custom quizzes
    const duplicateQuiz = quizzesDb.customQuizzes.find(q => q.pin === pinVal);
    if (duplicateQuiz) {
      alert(`The Game PIN "${pinVal}" is already in use by the quiz "${duplicateQuiz.title}". Please choose a different PIN.`);
      return;
    }

    if (this.questions.length === 0) {
      alert('You must add at least 1 question to publish this quiz.');
      return;
    }

    const uniqueId = `custom_${Date.now()}`;
    const newQuiz = {
      id: uniqueId,
      title: titleVal,
      category: catVal,
      timer: timerSeconds,
      pin: pinVal,
      description: `Custom build in Studio. Created on ${new Date().toLocaleDateString()}. Game PIN: ${pinVal}`,
      questions: [...this.questions]
    };

    quizzesDb.saveCustomQuiz(newQuiz);
    audioSynth.playSuccess();
    
    alert(`Successfully published quiz: "${titleVal}"! Saved to client board.`);
    this.reset();
    router.navigate('dashboard');
  }
}

const creatorStudio = new CreatorStudio();
window.creatorStudio = creatorStudio;

// ==========================================
// 8. PERFORMANCE ANALYTICS PANEL
// ==========================================
class Analytics {
  render() {
    this.renderHeatmap();
    this.renderRadar();
    this.renderStats();
  }

  renderStats() {
    const accuracyLbl = document.getElementById('analytics-stat-accuracy');
    const streakLbl = document.getElementById('analytics-stat-streak');
    
    const avgAcc = userState.totalQuestions > 0 ? Math.round((userState.totalCorrect / userState.totalQuestions) * 100) : 0;
    if (accuracyLbl) accuracyLbl.textContent = `${avgAcc}%`;
    if (streakLbl) streakLbl.textContent = `${userState.streak} Ans`;
  }

  renderHeatmap() {
    const grid = document.getElementById('analytics-heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // We will render a timeline map of the last 50 questions answered
    // Read from recent history answersHistory
    const totalSlots = 50;
    const responses = [];

    // Collate answers from history items
    userState.history.forEach(h => {
      if (h.answersHistory) {
        h.answersHistory.forEach(ans => {
          responses.push(ans);
        });
      }
    });

    // Crop or pad to 50
    const padding = totalSlots - responses.length;
    
    // Draw grid items (padding first = unplayed, then historical, then recent)
    for (let i = 0; i < totalSlots; i++) {
      const item = document.createElement('span');
      item.className = "w-7 h-7 rounded border transition-all duration-300 ";

      if (i < padding) {
        // Unplayed
        item.className += "bg-white/5 border-white/5 hover:bg-white/10";
        item.title = "Unplayed slot";
      } else {
        const responseIdx = i - padding;
        const correct = responses[responseIdx];
        if (correct) {
          item.className += "bg-secondary/20 border-secondary/50 hover:bg-secondary/40 shadow-[0_0_8px_rgba(76,215,246,0.15)]";
          item.title = `Answer ${responseIdx + 1}: Correct`;
        } else {
          item.className += "bg-red-500/20 border-red-500/40 hover:bg-red-500/35";
          item.title = `Answer ${responseIdx + 1}: Wrong`;
        }
      }
      grid.appendChild(item);
    }
  }

  renderRadar() {
    const canvas = document.getElementById('analytics-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Canvas size setup
    const size = 360;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 120;

    // Categories array
    const categories = ["Technology", "Science", "History", "Geography", "Other"];
    const totalAxes = categories.length;

    // Accuracy ratings mapping (Default 50% if no history)
    const accuracyMap = {
      "Technology": { correct: 0, total: 0 },
      "Science": { correct: 0, total: 0 },
      "History": { correct: 0, total: 0 },
      "Geography": { correct: 0, total: 0 },
      "Other": { correct: 0, total: 0 }
    };

    // Read scores from history
    userState.history.forEach(h => {
      const cat = h.category || "Other";
      const qCount = h.answersHistory ? h.answersHistory.length : 5;
      const cCount = h.answersHistory ? h.answersHistory.filter(Boolean).length : Math.round((h.accuracy / 100) * qCount);

      if (accuracyMap[cat]) {
        accuracyMap[cat].correct += cCount;
        accuracyMap[cat].total += qCount;
      } else {
        accuracyMap["Other"].correct += cCount;
        accuracyMap["Other"].total += qCount;
      }
    });

    const values = categories.map(cat => {
      const data = accuracyMap[cat];
      return data.total > 0 ? (data.correct / data.total) : 0.5; // default 50%
    });

    // Clear Canvas
    ctx.clearRect(0, 0, size, size);

    // 1. Draw web pentagons (5 rings)
    const levels = 5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let j = 1; j <= levels; j++) {
      const r = (radius / levels) * j;
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 2. Draw axis lines
    ctx.beginPath();
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Draw Category labels
    ctx.fillStyle = "#cbc3d7";
    ctx.font = "bold 11px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;
      const labelDist = radius + 22;
      const x = cx + labelDist * Math.cos(angle);
      const y = cy + labelDist * Math.sin(angle);
      ctx.fillText(categories[i], x, y);
    }

    // 4. Plot User Data Polygonal Path
    ctx.beginPath();
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;
      const r = radius * values[i];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Fill with gradient purple/cyan
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    grad.addColorStop(0, "rgba(208, 188, 255, 0.2)");
    grad.addColorStop(1, "rgba(76, 215, 246, 0.2)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke with neon cyan
    ctx.strokeStyle = "#4cd7f6";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#4cd7f6";
    ctx.stroke();

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // 5. Draw small dots on data vertices
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;
      const r = radius * values[i];
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#d0bcff";
      ctx.fill();
      ctx.strokeStyle = "#dae2fd";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ==========================================
// 8b. MULTIPLAYER LOBBY AND PODIUM CONTROLLER
// ==========================================
class LobbyEngine {
  constructor() {
    this.activeRoomPin = null;
    this.activeQuizId = null;
    this.isHost = false;
    this.lobbyPlayers = [];
    this.joinTimer = null;
    this.publicUrl = localStorage.getItem('qs_public_url') || '';
    this.podiumPollInterval = null;
  }

  // Save teacher's public tunnel URL and update QR
  setPublicUrl() {
    const input = document.getElementById('lobby-public-url-input');
    if (!input) return;
    let url = input.value.trim().replace(/\/$/, ''); // strip trailing slash
    if (!url) { alert('Please paste your tunnel URL first.'); return; }
    if (!url.startsWith('http')) url = 'https://' + url;
    this.publicUrl = url;
    localStorage.setItem('qs_public_url', url);
    this.updateQrCode(this.activeRoomPin);
    audioSynth.playSuccess();
  }

  // Generate QR code and share URL using free API
  updateQrCode(pin) {
    const cleanPin = pin ? pin.replace(/\s/g, '') : '';
    const baseUrl = this.publicUrl || window.location.origin;
    const shareUrl = `${baseUrl}?pin=${cleanPin}`;

    const shareInput = document.getElementById('lobby-share-url');
    if (shareInput) shareInput.value = shareUrl;

    const qrImg = document.getElementById('lobby-qr-code');
    if (qrImg) {
      const encodedUrl = encodeURIComponent(shareUrl);
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0b1326&bgcolor=ffffff&data=${encodedUrl}`;
    }

    // Pre-fill tunnel URL input
    const urlInput = document.getElementById('lobby-public-url-input');
    if (urlInput && this.publicUrl) urlInput.value = this.publicUrl;
  }

  // Copy share URL to clipboard
  copyShareUrl() {
    const shareInput = document.getElementById('lobby-share-url');
    if (!shareInput) return;
    navigator.clipboard.writeText(shareInput.value).then(() => {
      audioSynth.playSuccess();
      const btn = document.querySelector('button[onclick="lobbyEngine.copyShareUrl()"]');
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
    }).catch(() => {
      shareInput.select();
      document.execCommand('copy');
    });
  }

  host(quizId) {
    audioSynth.playClick();
    const quiz = quizzesDb.getQuizById(quizId);
    if (!quiz) {
      alert('Quiz not found.');
      return;
    }
    const pin = quiz.pin ? quiz.pin.toString() : Math.floor(100000 + Math.random() * 900000).toString();
    const cleanPin = pin.replace(/\s/g, '');
    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');

    // POST /api/create to register room on backend
    fetch(`${apiBase}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: quiz, requestedPin: cleanPin })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        router.navigate('lobby', { pin: cleanPin, quizId: quizId, isHost: true });
      } else {
        alert('Could not create multiplayer lobby on backend: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(err => {
      console.error(err);
      // Fallback - navigate anyway
      router.navigate('lobby', { pin: cleanPin, quizId: quizId, isHost: true });
    });
  }

  joinPin() {
    audioSynth.playClick();
    const pinInput = document.getElementById('join-pin-input') || document.getElementById('join-pin-input-desktop');
    const pin = pinInput ? pinInput.value.trim() : "";
    if (!pin) {
      alert("Please enter a 6-digit Game PIN.");
      return;
    }
    const cleaned = pin.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      alert("Game PIN must be a 6-digit number.");
      return;
    }

    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
    fetch(`${apiBase}/api/room/${cleaned}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(roomData => {
        this.showStudentJoinForm(cleaned, roomData.quiz);
      })
      .catch(() => {
        alert(`No active quiz found on the server with Game PIN "${cleaned}". Ask your teacher if the quiz has been started.`);
      });
  }

  showStudentJoinForm(pin, serverQuiz) {
    const cleanPin = pin ? pin.toString().replace(/\s/g, '') : '';
    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');

    const existing = document.getElementById('student-join-overlay');
    if (existing) existing.remove();

    const joinOverlay = document.createElement('div');
    joinOverlay.id = 'student-join-overlay';
    joinOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.97);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    joinOverlay.innerHTML = `
      <div style="background:rgba(11,19,38,0.95);border:1px solid rgba(208,188,255,0.25);border-radius:24px;padding:40px 32px;max-width:420px;width:100%;box-shadow:0 0 60px rgba(208,188,255,0.1);text-align:center;">
        <div style="width:64px;height:64px;background:rgba(208,188,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <span class="material-symbols-outlined" style="font-size:32px;color:#d0bcff;">quiz</span>
        </div>
        <h2 style="font-size:24px;font-weight:800;color:#dae2fd;margin-bottom:4px;">Join Live Quiz!</h2>
        <p style="font-size:13px;color:#958ea0;margin-bottom:24px;">Enter your details to join the session</p>

        <div style="background:rgba(76,215,246,0.06);border:1px solid rgba(76,215,246,0.25);border-radius:14px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#4cd7f6;">Game PIN</span>
          <span style="font-size:22px;font-weight:900;font-family:monospace;color:#d0bcff;letter-spacing:0.15em;">${cleanPin}</span>
        </div>

        <div style="margin-bottom:14px;text-align:left;">
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#958ea0;display:block;margin-bottom:6px;">Your Name *</label>
          <div style="position:relative;">
            <span class="material-symbols-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#958ea0;font-size:18px;">person</span>
            <input id="sj-name" type="text" placeholder="e.g. Ali Hassan" autocomplete="name"
              value="${userState.username !== 'User' && userState.username !== 'Guest' ? userState.username : ''}"
              style="width:100%;background:#020617;border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 12px 12px 40px;color:#dae2fd;font-size:15px;outline:none;box-sizing:border-box;"
              onfocus="this.style.borderColor='#d0bcff'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
          </div>
        </div>

        <div style="margin-bottom:22px;text-align:left;">
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#958ea0;display:block;margin-bottom:6px;">Email Address *</label>
          <div style="position:relative;">
            <span class="material-symbols-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#958ea0;font-size:18px;">mail</span>
            <input id="sj-email" type="email" placeholder="e.g. student@school.com" autocomplete="email"
              value="${userState.email || ''}"
              style="width:100%;background:#020617;border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 12px 12px 40px;color:#dae2fd;font-size:15px;outline:none;box-sizing:border-box;"
              onfocus="this.style.borderColor='#4cd7f6'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
          </div>
        </div>

        <div id="sj-error" style="display:none;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:#ff6b6b;margin-bottom:14px;text-align:left;"></div>

        <button id="sj-btn" onclick="window._studentJoin('${cleanPin}', '${apiBase}')"
          style="width:100%;padding:14px;background:linear-gradient(135deg,#d0bcff,#a078ff);border:none;border-radius:14px;color:#23005c;font-size:16px;font-weight:800;cursor:pointer;transition:all 0.2s;box-shadow:0 0 25px rgba(208,188,255,0.3);">
          Join Quiz Now
        </button>
        <p style="font-size:11px;color:#958ea0;margin-top:12px;">Only students invited by your teacher can join</p>
      </div>
    `;
    document.body.appendChild(joinOverlay);

    // Focus name field
    setTimeout(() => {
      const nameEl = document.getElementById('sj-name');
      if (nameEl) nameEl.focus();
    }, 100);
  }

  initLobby(pin, quizId, isHost) {
    this.activeRoomPin = pin;
    this.activeQuizId = quizId;
    this.isHost = isHost;
    this.lobbyPlayers = [];

    const cleanPin = pin.replace(/\s/g, '');
    
    document.getElementById('lobby-pin-display').textContent = pin;
    document.getElementById('lobby-status-text').textContent = isHost ? "Waiting for students to join..." : "Joined! Waiting for the host to start...";
    document.getElementById('lobby-players-count').textContent = `Players (0)`;

    // Generate QR code and share URL
    this.updateQrCode(pin);

    const grid = document.getElementById('lobby-players-grid');
    grid.innerHTML = '';

    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');

    // Poll the backend room details for players & game start status
    clearInterval(this.joinTimer);
    const pollRoomStatus = () => {
      fetch(`${apiBase}/api/room/${cleanPin}`)
        .then(res => res.json())
        .then(roomData => {
          // Update player list UI
          if (roomData.scores) {
            grid.innerHTML = '';
            this.lobbyPlayers = roomData.scores.map(s => s.name);
            document.getElementById('lobby-players-count').textContent = `Players (${this.lobbyPlayers.length})`;
            
            roomData.scores.forEach(player => {
              const isCurrentUser = player.name === userState.username;
              this.addPlayerChip(player.name, isCurrentUser);
            });
          }

          // Student: Auto start when room status is playing
          if (!isHost && roomData.state === 'playing') {
            clearInterval(this.joinTimer);
            
            // Remove waiting overlay if student joined via URL overlay
            const waitOverlay = document.getElementById('student-waiting-overlay');
            if (waitOverlay) waitOverlay.remove();

            quizEngine.activeRoomPin = cleanPin;
            quizEngine.activePlayerName = userState.username;
            quizEngine.activeApiBase = apiBase;
            quizEngine.startWithData(roomData.quiz);
          }
        })
        .catch(err => console.error(err));
    };

    pollRoomStatus();
    this.joinTimer = setInterval(pollRoomStatus, 1500);
  }

  addPlayerChip(name, isUser = false) {
    const grid = document.getElementById('lobby-players-grid');
    const chip = document.createElement('div');
    chip.className = `flex items-center gap-2 p-2.5 rounded-xl border animate-in zoom-in duration-300 ${isUser ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/5 border-white/10 text-on-surface'}`;
    chip.innerHTML = `
      <span class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">${name.charAt(0).toUpperCase()}</span>
      <span class="text-xs font-bold truncate">${name}</span>
    `;
    grid.appendChild(chip);
  }

  leave() {
    audioSynth.playClick();
    clearInterval(this.joinTimer);
    if (this.podiumPollInterval) clearInterval(this.podiumPollInterval);
    this.activeRoomPin = null;
    this.activeQuizId = null;
    router.navigate('dashboard');
  }

  deleteLobby() {
    audioSynth.playClick();
    if (!this.activeRoomPin) return;
    showConfirm(
      'Are you sure you want to delete this live quiz room? All joined students will be disconnected.',
      () => {
        const cleanPin = this.activeRoomPin.replace(/\s/g, '');
        const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
        fetch(`${apiBase}/api/room/${cleanPin}`, { method: 'DELETE' })
          .then(() => {
            clearInterval(this.joinTimer);
            if (this.podiumPollInterval) clearInterval(this.podiumPollInterval);
            this.activeRoomPin = null;
            this.activeQuizId = null;
            alert('Lobby deleted successfully.');
            router.navigate('dashboard');
          })
          .catch(err => {
            console.error(err);
            alert('Could not delete room from server.');
          });
      },
      'Delete Room',
      true
    );
  }

  startGame() {
    audioSynth.playClick();
    clearInterval(this.joinTimer);

    if (this.isHost && this.activeRoomPin) {
      const cleanPin = this.activeRoomPin.replace(/\s/g, '');
      const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');

      // Tell backend to start quiz
      fetch(`${apiBase}/api/start/${cleanPin}`, { method: 'POST' })
        .then(() => {
          quizEngine.activeRoomPin = cleanPin;
          quizEngine.activePlayerName = userState.username;
          quizEngine.activeApiBase = apiBase;
          quizEngine.start(this.activeQuizId);
        })
        .catch(err => {
          console.error(err);
          // Fallback start anyway
          quizEngine.activeRoomPin = cleanPin;
          quizEngine.activePlayerName = userState.username;
          quizEngine.activeApiBase = apiBase;
          quizEngine.start(this.activeQuizId);
        });
    } else {
      quizEngine.start(this.activeQuizId);
    }
  }

  // ==========================================
  // HOST CONTROL FLOW METHODS (State Machine)
  // ==========================================
  
  // Called when host enters the live control view
  initHostControl(pin, quizId) {
    this.activeRoomPin = pin;
    this.activeQuizId = quizId;
    this.isHost = true;
    
    const cleanPin = pin.replace(/\s/g, '');
    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
    const quiz = quizzesDb.getQuizById(quizId);

    if (!quiz) {
      alert('Quiz not found');
      router.navigate('dashboard');
      return;
    }

    // Update UI with quiz info
    document.getElementById('hc-quiz-title').textContent = quiz.title;
    document.getElementById('hc-q-index').textContent = `Question 1 of ${quiz.questions.length}`;

    // Start polling for room state and student submissions
    clearInterval(this.hostControlInterval);
    this.hostControlInterval = setInterval(() => {
      fetch(`${apiBase}/api/room/${cleanPin}`)
        .then(res => res.json())
        .then(roomData => {
          this.updateHostControlUI(roomData, quiz);
        })
        .catch(err => console.error('Host control poll error:', err));
    }, 1000);

    // Initial load
    fetch(`${apiBase}/api/room/${cleanPin}`)
      .then(res => res.json())
      .then(roomData => {
        this.updateHostControlUI(roomData, quiz);
      })
      .catch(err => console.error(err));
  }

  updateHostControlUI(roomData, quiz) {
    if (!roomData) return;

    const questionPanel = document.getElementById('hc-question-panel');
    const leaderboardPanel = document.getElementById('hc-leaderboard-panel');
    const podiumPanel = document.getElementById('hc-podium-panel');

    if (roomData.state === 'playing') {
      // Show question
      if (questionPanel) questionPanel.classList.remove('hidden');
      if (leaderboardPanel) leaderboardPanel.classList.add('hidden');
      if (podiumPanel) podiumPanel.classList.add('hidden');

      const qIdx = roomData.currentQuestionIndex || 0;
      const question = quiz.questions[qIdx];
      if (question) {
        document.getElementById('hc-question-text').textContent = question.q;
        document.getElementById('hc-q-index').textContent = `Question ${qIdx + 1} of ${quiz.questions.length}`;

        // Display options
        const optionsGrid = document.getElementById('hc-options-grid');
        optionsGrid.innerHTML = '';
        question.options.forEach((opt, idx) => {
          const btn = document.createElement('div');
          btn.className = 'p-4 rounded-xl border border-white/10 bg-white/5 text-on-surface text-left';
          btn.innerHTML = `<span class="font-bold">${String.fromCharCode(65 + idx)}:</span> ${opt}`;
          optionsGrid.appendChild(btn);
        });

        // Count answered students
        const answered = roomData.scores.filter(s => s.lastQuestionAnswered >= qIdx).length;
        document.getElementById('hc-answered-count').textContent = `${answered} / ${roomData.scores.length} answered`;
      }
    } else if (roomData.state === 'leaderboard') {
      // Show leaderboard
      if (questionPanel) questionPanel.classList.add('hidden');
      if (leaderboardPanel) leaderboardPanel.classList.remove('hidden');
      if (podiumPanel) podiumPanel.classList.add('hidden');

      const leaderboardList = document.getElementById('hc-leaderboard-list');
      leaderboardList.innerHTML = '';
      roomData.scores.forEach((player, idx) => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5 text-xs';
        let rankBadge = 'text-on-surface-variant';
        if (idx === 0) rankBadge = 'text-yellow-400 font-bold';
        else if (idx === 1) rankBadge = 'text-slate-300 font-bold';
        else if (idx === 2) rankBadge = 'text-amber-600 font-bold';

        row.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="w-5 text-center font-bold ${rankBadge}">#${idx + 1}</span>
            <span class="font-bold">${player.name}</span>
          </div>
          <div class="flex items-center gap-6">
            <span class="text-on-surface-variant">${player.correct} correct</span>
            <span class="font-mono font-bold text-secondary">${player.time}s</span>
          </div>
        `;
        leaderboardList.appendChild(row);
      });
    } else if (roomData.state === 'podium') {
      // Show podium prompt
      if (questionPanel) questionPanel.classList.add('hidden');
      if (leaderboardPanel) leaderboardPanel.classList.add('hidden');
      if (podiumPanel) podiumPanel.classList.remove('hidden');
    }
  }

  skipQuestion() {
    audioSynth.playClick();
    const cleanPin = this.activeRoomPin.replace(/\s/g, '');
    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
    
    fetch(`${apiBase}/api/room/${cleanPin}/next`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        console.log('Advanced to leaderboard via skip');
      })
      .catch(err => console.error(err));
  }

  nextStep() {
    audioSynth.playClick();
    const cleanPin = this.activeRoomPin.replace(/\s/g, '');
    const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
    
    fetch(`${apiBase}/api/room/${cleanPin}/next`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.state === 'podium') {
          clearInterval(this.hostControlInterval);
          // Transition to podium view
          router.navigate('podium', { pin: cleanPin });
        }
        console.log('State transitioned to:', data.state);
      })
      .catch(err => console.error(err));
  }

  showFinalPodium() {
    audioSynth.playFanfare();
    const cleanPin = this.activeRoomPin.replace(/\s/g, '');
    clearInterval(this.hostControlInterval);
    router.navigate('podium', { pin: cleanPin });
  }

  finishPinGame(correctCount, totalTimeTaken) {
    const quiz = quizzesDb.getQuizById(this.activeQuizId);
    const qCount = quiz ? quiz.questions.length : 5;
    const results = [
      { name: userState.username, correct: correctCount, time: parseFloat(totalTimeTaken.toFixed(2)), isUser: true }
    ];
    router.navigate('podium', { results: results });
  }

  renderPodium(results, pin) {
    audioSynth.playFanfare();

    if (this.podiumPollInterval) clearInterval(this.podiumPollInterval);

    const updatePodiumUI = (scores) => {
      // 1st, 2nd, 3rd places
      const first = scores[0] || { name: "-", correct: 0, time: 0 };
      const second = scores[1] || { name: "-", correct: 0, time: 0 };
      const third = scores[2] || { name: "-", correct: 0, time: 0 };

      document.getElementById('podium-name-1').textContent = first.name;
      document.getElementById('podium-score-1').textContent = `${first.time}s (${first.correct} correct)`;
      
      document.getElementById('podium-name-2').textContent = second.name;
      document.getElementById('podium-score-2').textContent = `${second.time}s (${second.correct} correct)`;
      
      document.getElementById('podium-name-3').textContent = third.name;
      document.getElementById('podium-score-3').textContent = `${third.time}s (${third.correct} correct)`;

      // Trigger animations
      const col1 = document.getElementById('podium-col-1');
      const col2 = document.getElementById('podium-col-2');
      const col3 = document.getElementById('podium-col-3');
      
      if (col1) {
        col1.classList.remove('translate-y-20', 'opacity-0');
        col1.classList.add('translate-y-0', 'opacity-100');
      }
      if (col2) {
        col2.classList.remove('translate-y-20', 'opacity-0');
        col2.classList.add('translate-y-0', 'opacity-100');
      }
      if (col3) {
        col3.classList.remove('translate-y-20', 'opacity-0');
        col3.classList.add('translate-y-0', 'opacity-100');
      }

      // Populate rankings list table
      const list = document.getElementById('podium-standings-list');
      if (list) {
        list.innerHTML = '';
        scores.forEach((r, idx) => {
          const row = document.createElement('div');
          const isCurrentUser = r.name === userState.username;
          row.className = `flex justify-between items-center p-3 rounded-xl border text-xs ${isCurrentUser ? 'bg-primary/10 border-primary/40 text-primary font-bold' : 'bg-white/5 border-white/5 text-on-surface'}`;
          
          let rankBadge = `text-on-surface-variant`;
          if (idx === 0) rankBadge = `text-yellow-400 font-bold`;
          else if (idx === 1) rankBadge = `text-slate-300 font-bold`;
          else if (idx === 2) rankBadge = `text-amber-600 font-bold`;

          row.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="w-5 text-center font-bold ${rankBadge}">#${idx + 1}</span>
              <span class="font-bold truncate max-w-[200px]">${r.name}</span>
            </div>
            <div class="flex items-center gap-6">
              <span class="text-on-surface-variant font-label-md">${r.correct} Correct</span>
              <span class="font-mono font-bold text-secondary">${r.time}s</span>
            </div>
          `;
          list.appendChild(row);
        });
      }
    };

    if (pin) {
      const apiBase = (window.QS_API_BASE || localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
      const fetchScores = () => {
        fetch(`${apiBase}/api/room/${pin}`)
          .then(res => res.json())
          .then(roomData => {
            if (roomData.scores) {
              updatePodiumUI(roomData.scores);
            }
          })
          .catch(err => console.error(err));
      };
      fetchScores();
      this.podiumPollInterval = setInterval(fetchScores, 1500);
    } else if (results) {
      updatePodiumUI(results);
    }
  }
}

const lobbyEngine = new LobbyEngine();
window.lobbyEngine = lobbyEngine;

const analytics = new Analytics();
window.analytics = analytics;

function showConfirm(message, onConfirm, actionText = 'Confirm', isDanger = true) {
  const modal = document.getElementById('confirm-modal');
  const messageEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  const titleEl = document.getElementById('confirm-modal-title');
  const iconEl = document.getElementById('confirm-modal-icon');
  const iconContainerEl = document.getElementById('confirm-modal-icon-container');

  if (!modal || !messageEl || !confirmBtn || !cancelBtn) return;

  messageEl.textContent = message;
  confirmBtn.textContent = actionText;

  if (isDanger) {
    if (titleEl) titleEl.textContent = "Are you sure?";
    if (iconEl) iconEl.textContent = "warning";
    if (iconContainerEl) iconContainerEl.className = "w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20";
    if (iconEl) iconEl.className = "material-symbols-outlined text-red-400 text-3xl";
    confirmBtn.className = "flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all";
  } else {
    if (titleEl) titleEl.textContent = "Confirm Action";
    if (iconEl) iconEl.textContent = "info";
    if (iconContainerEl) iconContainerEl.className = "w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20";
    if (iconEl) iconEl.className = "material-symbols-outlined text-primary text-3xl";
    confirmBtn.className = "flex-1 py-3 bg-gradient-to-r from-primary to-secondary text-on-primary font-bold text-sm rounded-xl hover:shadow-[0_0_20px_rgba(208,188,255,0.3)] transition-all";
  }

  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  modal.classList.remove('hidden');

  newCancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  newConfirmBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    onConfirm();
  });
}
window.showConfirm = showConfirm;

// ==========================================
// 9. WINDOW ONLOAD AND SCROLL INTERACTION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Load user
  loadUser();

  // Load custom quizzes from local library
  quizzesDb.loadCustomQuizzes();

  // Fetch server config on load to get the dynamic tunnel URL or local IP
  fetch('/api/config')
    .then(res => res.json())
    .then(config => {
      const publicUrl = config.tunnelUrl || config.localIp;
      if (publicUrl) {
        localStorage.setItem('qs_public_url', publicUrl);
        lobbyEngine.publicUrl = publicUrl;
      }
    })
    .catch(err => console.log('Failed to fetch server config', err))
    .finally(() => {
      // Check URL for ?pin= parameter — auto-fill PIN for students joining via link/QR
      const urlParams = new URLSearchParams(window.location.search);
      const pinFromUrl = urlParams.get('pin');
      if (pinFromUrl && /^\d{6}$/.test(pinFromUrl)) {
        setTimeout(() => {
          const apiBase = (localStorage.getItem('qs_public_url') || window.location.origin).replace(/\/$/, '');
          const savedName = localStorage.getItem('qs_student_name');
          const savedEmail = localStorage.getItem('qs_student_email');
          
          // Auto-restore persistent student login if previously saved
          if (savedName && savedEmail) {
            console.log(`[AUTO-JOIN] Restoring student "${savedName}" via persistent login`);
            // Restore persistent credentials and auto-join
            window._studentJoinDirect(pinFromUrl, apiBase, savedName, savedEmail);
          } else {
            // First time joining - show join form
            console.log(`[FIRST-JOIN] Showing join form for PIN ${pinFromUrl}`);
            fetch(`${apiBase}/api/room/${pinFromUrl}`)
              .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
              })
              .then(roomData => {
                lobbyEngine.showStudentJoinForm(pinFromUrl, roomData.quiz);
              })
              .catch(() => {
                alert(`No active quiz found on the server with Game PIN "${pinFromUrl}". Ask your teacher if the quiz has been started.`);
              });
          }
        }, 300);
      }
    });

  // Direct join method bypassing the form modal
  window._studentJoinDirect = function(pin, apiBase, name, email) {
    // Show temporary overlay while checking join validity
    const directOverlay = document.createElement('div');
    directOverlay.id = 'direct-joining-overlay';
    directOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.97);z-index:9999;display:flex;align-items:center;justify-content:center;color:#e2e8f0;font-size:18px;font-weight:bold;';
    directOverlay.textContent = 'Restoring session & joining...';
    document.body.appendChild(directOverlay);

    fetch(`${apiBase}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin, name: name, email: email })
    })
    .then(res => res.json())
    .then(data => {
      directOverlay.remove();
      if (!data.success) {
        // Clear corrupt storage and load fallback form
        localStorage.removeItem('qs_student_name');
        localStorage.removeItem('qs_student_email');
        lobbyEngine.showStudentJoinForm(pin, null);
        return;
      }
      
      // Successfully auto-joined, render waiting screen
      window._showStudentWaitingScreen(pin, apiBase, name, email, data.quizTitle);
    })
    .catch(() => {
      directOverlay.remove();
      // Server down, load fallback form
      lobbyEngine.showStudentJoinForm(pin, null);
    });
  };

  // Helper method to render the player lobby waiting screen
  window._showStudentWaitingScreen = function(pin, apiBase, name, email, quizTitle) {
    // Remove waiting overlay if it exists
    const oldOverlay = document.getElementById('student-waiting-overlay');
    if (oldOverlay) oldOverlay.remove();

    const waitOverlay = document.createElement('div');
    waitOverlay.id = 'student-waiting-overlay';
    waitOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.97);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    waitOverlay.innerHTML = `
      <div style="background:rgba(26,22,49,0.95);border:1px solid rgba(99,102,241,0.25);border-radius:24px;padding:40px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 0 60px rgba(99,102,241,0.15);">
        <div style="font-size:64px;animation:spin 3s linear infinite;display:inline-block;margin-bottom:16px;">⏳</div>
        <h2 style="font-size:22px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">You're In! 🎉</h2>
        <p style="color:#8b5cf6;font-weight:700;font-size:18px;margin-bottom:4px;">${name}</p>
        <p style="color:#94a3b8;font-size:13px;margin-bottom:20px;">${email}</p>
        <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:12px 16px;margin-bottom:20px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8b5cf6;letter-spacing:0.1em;">Quiz</span>
          <p style="font-size:16px;font-weight:700;color:#e2e8f0;margin-top:4px;">${quizTitle || 'Live Quiz'}</p>
        </div>
        <p style="color:#94a3b8;font-size:14px;">Waiting for teacher to start the quiz...</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:16px;">
          <div style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.2s infinite;"></div>
          <div style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.2s infinite 0.4s;"></div>
          <div style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.2s infinite 0.8s;"></div>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-top:20px;">PIN: ${pin}</p>
      </div>
      <style>
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
      </style>
    `;
    document.body.appendChild(waitOverlay);

    // Poll for quiz start using the apiBase URL
    const pollInterval = setInterval(() => {
      fetch(`${apiBase}/api/room/${pin}`)
        .then(res => {
          if (!res.ok) throw new Error('Room closed');
          return res.json();
        })
        .then(roomData => {
          if (roomData.error) throw new Error(roomData.error);
          
          if (roomData.state === 'playing') {
            clearInterval(pollInterval);
            waitOverlay.remove();
            
            // Set student connection references
            quizEngine.activeRoomPin = pin;
            quizEngine.activePlayerName = name;
            quizEngine.activeApiBase = apiBase;
            
            // Trigger simultaneous start sync
            quizEngine.startWithData(roomData.quiz);
          }
        })
        .catch(() => {
          clearInterval(pollInterval);
          waitOverlay.remove();
          alert('This quiz room has been closed or deleted by the host.');
          router.navigate('landing');
        });
    }, 1500);
  };

  // Global function for student join button
  window._studentJoin = function(pin, apiBase) {
    const nameEl = document.getElementById('sj-name');
    const emailEl = document.getElementById('sj-email');
    const errorEl = document.getElementById('sj-error');
    const btn = document.getElementById('sj-btn');

    const name = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';

    if (!name) {
      errorEl.textContent = 'Please enter your name.';
      errorEl.style.display = 'block';
      nameEl.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      emailEl.focus();
      return;
    }

    errorEl.style.display = 'none';
    btn.textContent = 'Joining...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    // Save name to user state
    userState.username = name;
    userState.email = email;
    updateUI();

    // POST to /api/join using the correct server origin
    fetch(`${apiBase}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin, name: name, email: email })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        errorEl.textContent = data.error || 'Could not join quiz. Please try again.';
        errorEl.style.display = 'block';
        btn.textContent = 'Join Quiz Now';
        btn.disabled = false;
        btn.style.opacity = '1';
        return;
      }

      // Persist credentials locally
      localStorage.setItem('qs_student_name', name);
      localStorage.setItem('qs_student_email', email);

      // Remove join form
      const joinOverlay = document.getElementById('student-join-overlay');
      if (joinOverlay) joinOverlay.remove();

      // Show waiting screen
      window._showStudentWaitingScreen(pin, apiBase, name, email, data.quizTitle);
    })
    .catch(() => {
      errorEl.textContent = 'Cannot connect to server. Make sure you are using the correct link from your teacher.';
      errorEl.style.display = 'block';
      btn.textContent = 'Join Quiz Now';
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  };

  // Route to current page (or Landing by default)
  router.navigate('landing');

  // Interactive mouseparallax for ambient glow layers
  document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX - window.innerWidth / 2) / 60;
    const moveY = (e.clientY - window.innerHeight / 2) / 60;
    
    const glow1 = document.getElementById('bg-glow-1');
    const glow2 = document.getElementById('bg-glow-2');
    if (glow1) glow1.style.transform = `translate(${moveX}px, ${moveY}px)`;
    if (glow2) glow2.style.transform = `translate(${-moveX}px, ${-moveY}px)`;
  });

  // Attach click sound triggers to buttons
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      // Avoid triggering click sound on quiz options twice or results exit
      if (!btn.id.startsWith('opt-') && !btn.className.includes('quiz-run')) {
        audioSynth.playClick();
      }
    });
  });
});
