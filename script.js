/**
 * Whack It! - Child Friendly Fullscreen Web Game Engine
 * Combined Mode: Level Countdown Timer + Missed Hamster Escape Penalties + Raccoon Bombs.
 */

(function () {
  "use strict";

  /* --------------------------------------------------------------------------
     1. DOM & Canvas Setup
     -------------------------------------------------------------------------- */
  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");

  // DOM Elements
  var hudEl = document.getElementById("hud");
  var scoreText = document.getElementById("scoreText");
  var levelNameText = document.getElementById("levelNameText");
  var timerText = document.getElementById("timerText");
  var timerPill = document.querySelector(".timer-pill");
  var goalText = document.getElementById("goalText");
  var livesContainer = document.getElementById("livesContainer");
  var missText = document.getElementById("missText");

  var titleScreen = document.getElementById("titleScreen");
  var gameOverScreen = document.getElementById("gameOverScreen");
  var pauseScreen = document.getElementById("pauseScreen");

  var startBtn = document.getElementById("startBtn");
  var againBtn = document.getElementById("againBtn");
  var resumeBtn = document.getElementById("resumeBtn");

  var finalScoreText = document.getElementById("finalScoreText");
  var whackedText = document.getElementById("whackedText");
  var bestStreakText = document.getElementById("bestStreakText");
  var bestScoreText = document.getElementById("bestScoreText");
  var overTitle = document.getElementById("overTitle");
  var overReasonText = document.getElementById("overReasonText");

  /* --------------------------------------------------------------------------
     2. Dual Layout & Responsive Grid Engine (Mobile & Large Desktop Monitors)
     -------------------------------------------------------------------------- */
  var W = 420, H = 720, scale = 1, offX = 0, offY = 0, dpr = 1;
  var GRID_R = 3, GRID_C = 3;
  var gridTop = 100, gridBot = 700, cellW = 140, cellH = 180;

  function resize() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);

    W = 420;

    if (vw / vh < 0.8) {
      // Mobile portrait layout: fill full screen
      H = Math.max(560, Math.min(1000, Math.round(W * vh / vw)));
      scale = (vw * dpr) / W;
      offX = 0;
      offY = (vh * dpr - H * scale) / 2;
    } else {
      // Desktop / Tablet / Landscape layout: center stage gracefully
      H = 720;
      var aspect = W / H;
      var targetH = Math.min(vh * 0.94, 850);
      var targetW = targetH * aspect;

      if (targetW > vw * 0.95) {
        targetW = vw * 0.95;
        targetH = targetW / aspect;
      }

      scale = (targetW * dpr) / W;
      offX = (vw * dpr - targetW * dpr) / 2;
      offY = (vh * dpr - targetH * dpr) / 2;
    }

    gridTop = H * 0.14;
    gridBot = H * 0.92;
    cellW = W / GRID_C;
    cellH = (gridBot - gridTop) / GRID_R;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () {
    setTimeout(resize, 120);
  });

  /* --------------------------------------------------------------------------
     3. Web Audio Synthesizer (BGM & Event SFX Tones)
     -------------------------------------------------------------------------- */
  var actx = null;
  var masterGain = null;
  var bgmGain = null;
  var bgmInterval = null;
  var isBgmPlaying = false;
  var bgmNoteStep = 0;

  var BGM_MELODY = [
    261.63, 329.63, 392.00, 523.25,  392.00, 329.63, 261.63, 392.00,
    293.66, 349.23, 440.00, 587.33,  440.00, 349.23, 293.66, 440.00,
    329.63, 392.00, 523.25, 659.25,  523.25, 392.00, 329.63, 523.25,
    392.00, 440.00, 523.25, 659.25,  783.99, 659.25, 523.25, 392.00
  ];

  function initAudio() {
    if (!actx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        
        masterGain = actx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(actx.destination);

        bgmGain = actx.createGain();
        bgmGain.gain.value = 0.08;
        bgmGain.connect(masterGain);
      } catch (e) {
        actx = null;
      }
    }
    if (actx && actx.state === "suspended") {
      actx.resume();
    }
  }

  function startBgm() {
    initAudio();
    if (!actx || isBgmPlaying) return;
    isBgmPlaying = true;
    bgmNoteStep = 0;

    bgmInterval = setInterval(function () {
      if (!actx || !isBgmPlaying) return;
      var note = BGM_MELODY[bgmNoteStep % BGM_MELODY.length];
      bgmNoteStep++;

      try {
        var t0 = actx.currentTime;
        var osc = actx.createOscillator();
        var g = actx.createGain();

        osc.type = (bgmNoteStep % 8 === 0) ? "triangle" : "sine";
        osc.frequency.setValueAtTime(note, t0);

        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);

        osc.connect(g);
        g.connect(bgmGain);

        osc.start(t0);
        osc.stop(t0 + 0.18);
      } catch (e) {}
    }, 180);
  }

  function stopBgm() {
    isBgmPlaying = false;
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  }

  function playTone(o) {
    if (!actx) return;
    try {
      var t0 = actx.currentTime + (o.delay || 0);
      var osc = actx.createOscillator();
      var g = actx.createGain();

      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.from, t0);
      if (o.to) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
      }

      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);

      osc.connect(g);
      g.connect(masterGain);

      osc.start(t0);
      osc.stop(t0 + o.dur + 0.02);
    } catch (e) {}
  }

  function playNoise(dur, vol, freq) {
    if (!actx) return;
    try {
      var n = Math.floor(actx.sampleRate * dur);
      var buf = actx.createBuffer(1, n, actx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);

      var src = actx.createBufferSource();
      src.buffer = buf;
      var f = actx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq || 1000;
      f.Q.value = 1.2;

      var g = actx.createGain();
      g.gain.value = vol;

      src.connect(f);
      f.connect(g);
      g.connect(masterGain);
      src.start();
    } catch (e) {}
  }

  var sfx = {
    whack: function () {
      playNoise(0.04, 0.1, 1400);
      playTone({ from: 320, to: 160, dur: 0.08, type: "triangle", vol: 0.2 });
      playTone({ from: 523.25, dur: 0.12, type: "sine", vol: 0.15, delay: 0.02 });
    },
    gold: function () {
      playTone({ from: 659.25, dur: 0.1, type: "triangle", vol: 0.18 });
      playTone({ from: 880.00, dur: 0.12, type: "sine", vol: 0.2, delay: 0.06 });
      playTone({ from: 1046.50, dur: 0.18, type: "sine", vol: 0.18, delay: 0.12 });
    },
    bad: function () {
      playTone({ from: 300, to: 120, dur: 0.25, type: "sawtooth", vol: 0.15 });
      playTone({ from: 180, to: 90, dur: 0.3, type: "triangle", vol: 0.18, delay: 0.05 });
    },
    miss: function () {
      playTone({ from: 220, to: 140, dur: 0.12, type: "sine", vol: 0.1 });
    },
    streak: function () {
      var notes = [523.25, 659.25, 783.99, 1046.50];
      for (var i = 0; i < notes.length; i++) {
        playTone({ from: notes[i], dur: 0.14, type: "sine", vol: 0.16, delay: i * 0.05 });
      }
    },
    levelUp: function () {
      var notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
      for (var i = 0; i < notes.length; i++) {
        playTone({ from: notes[i], dur: 0.2, type: "triangle", vol: 0.2, delay: i * 0.06 });
      }
    },
    gameOver: function () {
      playTone({ from: 440, to: 350, dur: 0.2, type: "triangle", vol: 0.15 });
      playTone({ from: 350, to: 260, dur: 0.25, type: "triangle", vol: 0.15, delay: 0.18 });
      playTone({ from: 260, to: 196, dur: 0.4, type: "sine", vol: 0.18, delay: 0.38 });
    }
  };

  /* --------------------------------------------------------------------------
     4. Level Tiers & Combined Mode Goals
     -------------------------------------------------------------------------- */
  var TIERS = [
    { lvl: 1, name: "Sunny Meadow 🌱", target: 12, timeLimit: 45, maxMisses: 3, gap: [0.85, 1.3],  up: [1.1, 1.4], maxC: 1, bad: 0.1,  gold: 0.12 },
    { lvl: 2, name: "Bouncy Burrow 🐰", target: 20, timeLimit: 40, maxMisses: 3, gap: [0.68, 1.05], up: [0.95, 1.2], maxC: 2, bad: 0.14, gold: 0.12 },
    { lvl: 3, name: "Starry Park ⭐",   target: 28, timeLimit: 35, maxMisses: 3, gap: [0.52, 0.85], up: [0.75, 1.0], maxC: 2, bad: 0.18, gold: 0.14 },
    { lvl: 4, name: "Rainbow Rush 🌈", target: 36, timeLimit: 30, maxMisses: 3, gap: [0.42, 0.70], up: [0.60, 0.85], maxC: 3, bad: 0.22, gold: 0.15 },
    { lvl: 5, name: "Super Whack! ⚡", target: 45, timeLimit: 25, maxMisses: 3, gap: [0.32, 0.55], up: [0.48, 0.70], maxC: 3, bad: 0.25, gold: 0.15 }
  ];

  /* --------------------------------------------------------------------------
     5. Game State & Logic Variables
     -------------------------------------------------------------------------- */
  var STATE_TITLE = 0;
  var STATE_PLAY = 1;
  var STATE_PAUSED = 2;
  var STATE_OVER = 3;

  var state = STATE_TITLE;

  var holes = [];
  var particles = [];
  var popups = [];

  var score = 0;
  var lives = 3;
  var whacked = 0;
  var streak = 0;
  var bestStreak = 0;
  var tier = 0;
  var tierFlash = 0;
  var bestScore = 0;
  var alive = true;
  var tclock = 0;
  var shake = 0;
  var flashRed = 0;
  var spawnTimer = 0;

  // Combined Mode Level Variables
  var levelTimer = 45;
  var levelWhacked = 0;
  var levelMisses = 0;
  var gameOverReason = "Out of hearts! 💔";

  try {
    bestScore = parseInt(localStorage.getItem("whack_best_score") || "0", 10) || 0;
  } catch (e) {}

  function holeXY(i) {
    var r = (i / GRID_C) | 0;
    var c = i % GRID_C;
    return {
      x: cellW * (c + 0.5),
      y: gridTop + cellH * (r + 0.5)
    };
  }

  function resetGame() {
    holes = [];
    for (var i = 0; i < GRID_R * GRID_C; i++) {
      var p = holeXY(i);
      holes.push({
        x: p.x,
        y: p.y,
        state: "empty",
        type: null,
        t: 0,
        upDur: 1,
        wasHit: false,
        phase: Math.random() * Math.PI * 2
      });
    }

    particles = [];
    popups = [];
    score = 0;
    lives = 3;
    whacked = 0;
    streak = 0;
    bestStreak = 0;
    tier = 0;
    tierFlash = 1.2;
    alive = true;
    tclock = 0;
    shake = 0;
    flashRed = 0;
    spawnTimer = 0.5;

    levelWhacked = 0;
    levelMisses = 0;
    levelTimer = TIERS[0].timeLimit;

    renderHeartsUI();
    updateHUDUI();
  }

  function renderHeartsUI() {
    livesContainer.innerHTML = "";
    for (var i = 0; i < 3; i++) {
      var heart = document.createElement("span");
      heart.className = "heart-icon" + (i < lives ? "" : " lost");
      heart.textContent = "❤️";
      livesContainer.appendChild(heart);
    }
  }

  function updateHUDUI() {
    var t = TIERS[tier];
    scoreText.textContent = score;
    levelNameText.textContent = "LVL " + t.lvl;

    // Timer display
    var secondsLeft = Math.max(0, Math.ceil(levelTimer));
    timerText.textContent = secondsLeft + "s";
    if (secondsLeft <= 8) {
      timerPill.classList.add("warning");
    } else {
      timerPill.classList.remove("warning");
    }

    // Goal & Misses
    goalText.textContent = levelWhacked + " / " + t.target;
    missText.textContent = levelMisses + " / " + t.maxMisses + " 💨";
  }

  function burstParticles(x, y, n, color, spread, power) {
    for (var i = 0; i < n; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * power;
      particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        r: 3 + Math.random() * 4,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        color: color
      });
    }
  }

  function pickType(t) {
    var r = Math.random();
    if (r < t.bad) return "bad";
    if (r < t.bad + t.gold) return "gold";
    return "normal";
  }

  /* --------------------------------------------------------------------------
     6. High-Precision Touch & Hit Detection Engine
     -------------------------------------------------------------------------- */
  function creatureRise(h) {
    var rise;
    if (h.state === "rising") rise = h.t / 0.12;
    else if (h.state === "up") rise = 1;
    else if (h.state === "ducking") rise = 1 - h.t / 0.12;
    else rise = Math.max(0, 1 - h.t / 0.30);
    return Math.max(0, Math.min(1, rise));
  }

  function creatureCenter(h) {
    var rise = creatureRise(h);
    var popH = cellH * 0.55 * rise;
    return {
      x: h.x,
      y: h.y - popH * 0.5
    };
  }

  function tapAt(x, y) {
    if (state !== STATE_PLAY || !alive) return;

    var hitTarget = null;
    var minDist = Infinity;

    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      
      if (h.state !== "up" && h.state !== "rising" && h.state !== "ducking") continue;
      if (h.state === "ducking" && h.t > 0.08) continue;

      var cPos = creatureCenter(h);
      var dx = x - cPos.x;
      var dy = y - cPos.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var hitRadius = Math.min(cellW, cellH) * 0.46;

      if (dist < hitRadius && dist < minDist) {
        minDist = dist;
        hitTarget = h;
      }
    }

    if (!hitTarget) return;

    hitTarget.state = "hit";
    hitTarget.t = 0;
    hitTarget.wasHit = true;

    if (hitTarget.type === "bad") {
      lives--;
      streak = 0;
      sfx.bad();
      shake = Math.max(shake, 0.6);
      flashRed = 1;
      burstParticles(hitTarget.x, hitTarget.y, 16, "#ff4d4f", 24, 3.5);
      popups.push({ x: hitTarget.x, y: hitTarget.y - 28, life: 1, text: "-1 Heart 💔", color: "#ff4d4f" });

      renderHeartsUI();
      updateHUDUI();

      if (lives <= 0) {
        gameOverReason = "Ouch! Sneaky Raccoon bit you! 🦝";
        triggerGameOver();
      }
    } else {
      whacked++;
      levelWhacked++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);

      var bonus = Math.floor(streak / 5) * 2;
      if (hitTarget.type === "gold") {
        var addedGold = 5 + bonus;
        score += addedGold;
        sfx.gold();
        burstParticles(hitTarget.x, hitTarget.y, 20, "#ffc53d", 28, 4);
        popups.push({ x: hitTarget.x, y: hitTarget.y - 28, life: 1, text: "+" + addedGold + " ⭐", color: "#faad14" });
      } else {
        var addedNormal = 1 + bonus;
        score += addedNormal;
        sfx.whack();
        burstParticles(hitTarget.x, hitTarget.y, 12, "#73d13d", 20, 3);
        popups.push({ x: hitTarget.x, y: hitTarget.y - 28, life: 1, text: "+" + addedNormal, color: "#52c41a" });
      }

      if (streak > 0 && streak % 5 === 0) {
        sfx.streak();
        shake = Math.max(shake, 0.25);
      }

      // Check Level Advancement Goal
      var t = TIERS[tier];
      if (levelWhacked >= t.target) {
        advanceLevel();
      } else {
        updateHUDUI();
      }
    }
  }

  function advanceLevel() {
    if (tier < TIERS.length - 1) {
      tier++;
    }
    var newT = TIERS[tier];
    levelWhacked = 0;
    levelMisses = 0;
    levelTimer = newT.timeLimit;
    tierFlash = 1.4;
    shake = Math.max(shake, 0.4);
    sfx.levelUp();
    burstParticles(W / 2, H * 0.4, 30, "#ffc53d", 60, 5);
    popups.push({ x: W / 2, y: H * 0.35, life: 1.5, text: "LEVEL CLEARED! 🌟", color: "#73d13d" });

    renderHeartsUI();
    updateHUDUI();
  }

  function triggerGameOver() {
    alive = false;
    shake = 0.8;
    sfx.gameOver();

    setTimeout(function () {
      showGameOverScreen();
    }, 400);
  }

  /* --------------------------------------------------------------------------
     7. Game Loop & Physics Update
     -------------------------------------------------------------------------- */
  function activeCount() {
    var count = 0;
    for (var i = 0; i < holes.length; i++) {
      if (holes[i].state !== "empty") count++;
    }
    return count;
  }

  function stepGame(dt) {
    tclock += dt;
    var t = TIERS[tier];

    // Countdown Level Timer
    levelTimer -= dt;
    if (levelTimer <= 0) {
      levelTimer = 0;
      if (levelWhacked >= t.target) {
        advanceLevel();
      } else {
        gameOverReason = "Time's Up! Missed level goal! ⏱️";
        triggerGameOver();
        return;
      }
    }
    updateHUDUI();

    // Spawn animals
    spawnTimer -= dt;
    if (spawnTimer <= 0 && activeCount() < t.maxC) {
      var empties = [];
      for (var i = 0; i < holes.length; i++) {
        if (holes[i].state === "empty") empties.push(holes[i]);
      }
      if (empties.length > 0) {
        var pickHole = empties[(Math.random() * empties.length) | 0];
        pickHole.state = "rising";
        pickHole.t = 0;
        pickHole.wasHit = false;
        pickHole.type = pickType(t);
        pickHole.upDur = t.up[0] + Math.random() * (t.up[1] - t.up[0]);
        spawnTimer = t.gap[0] + Math.random() * (t.gap[1] - t.gap[0]);
      } else {
        spawnTimer = 0.15;
      }
    }

    // Update hole animals & check missed escapes
    for (var j = 0; j < holes.length; j++) {
      var h = holes[j];
      h.t += dt;

      if (h.state === "rising" && h.t >= 0.12) {
        h.state = "up";
        h.t = 0;
      } else if (h.state === "up" && h.t >= h.upDur) {
        h.state = "ducking";
        h.t = 0;
      } else if (h.state === "ducking" && h.t >= 0.12) {
        // Check if a normal or gold hamster escaped without being hit
        if (!h.wasHit && h.type !== "bad") {
          levelMisses++;
          sfx.miss();
          popups.push({ x: h.x, y: h.y - 20, life: 0.8, text: "Escaped! 💨", color: "#ff7a45" });

          if (levelMisses >= t.maxMisses) {
            lives--;
            levelMisses = 0;
            shake = Math.max(shake, 0.5);
            flashRed = 1;
            sfx.bad();
            renderHeartsUI();

            if (lives <= 0) {
              gameOverReason = "Too many hamsters escaped! 💨";
              triggerGameOver();
              return;
            }
          }
        }
        h.state = "empty";
        h.type = null;
      } else if (h.state === "hit" && h.t >= 0.30) {
        h.state = "empty";
        h.type = null;
      }
    }

    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt * 60;
      pt.y += pt.vy * dt * 60;
      pt.vy += 0.2 * dt * 60;
      pt.life -= pt.decay * dt * 60;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    for (var u = popups.length - 1; u >= 0; u--) {
      popups[u].y -= 0.8 * dt * 60;
      popups[u].life -= 0.022 * dt * 60;
      if (popups[u].life <= 0) popups.splice(u, 1);
    }

    if (shake > 0) shake = Math.max(0, shake - 2.5 * dt);
    if (flashRed > 0) flashRed = Math.max(0, flashRed - 2 * dt);
    if (tierFlash > 0) tierFlash = Math.max(0, tierFlash - 0.6 * dt);
  }

  function ambientStep(dt) {
    tclock += dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0 && activeCount() < 1) {
      var empties = [];
      for (var i = 0; i < holes.length; i++) {
        if (holes[i].state === "empty") empties.push(holes[i]);
      }
      if (empties.length > 0) {
        var h = empties[(Math.random() * empties.length) | 0];
        h.state = "rising";
        h.t = 0;
        h.type = "normal";
        h.upDur = 1.2;
        spawnTimer = 1.0;
      }
    }
    for (var j = 0; j < holes.length; j++) {
      var hh = holes[j];
      hh.t += dt;
      if (hh.state === "rising" && hh.t >= 0.12) { hh.state = "up"; hh.t = 0; }
      else if (hh.state === "up" && hh.t >= hh.upDur) { hh.state = "ducking"; hh.t = 0; }
      else if (hh.state === "ducking" && hh.t >= 0.12) { hh.state = "empty"; hh.type = null; }
    }
  }

  /* --------------------------------------------------------------------------
     8. Canvas Renderer (Child Friendly Visuals)
     -------------------------------------------------------------------------- */
  function drawHole(h) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + cellH * 0.12, cellW * 0.38, cellH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    var g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, cellW * 0.38);
    g.addColorStop(0, "#734a26");
    g.addColorStop(0.7, "#543417");
    g.addColorStop(1, "#36200b");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, cellW * 0.38, cellH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e1206";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, cellW * 0.28, cellH * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCreature(h) {
    if (h.state === "empty") return;

    var rise = creatureRise(h);
    var popH = cellH * 0.55 * rise;
    var cx = h.x;
    var cy = h.y - popH * 0.5;
    var squish = h.state === "hit" ? Math.min(1, h.t / 0.15) : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(h.x - cellW * 0.5, h.y - cellH * 0.7, cellW, cellH * 0.7 + 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.scale(1 + squish * 0.3, 1 - squish * 0.45);

    var bob = h.state === "up" ? Math.sin(tclock * 6 + h.phase) * 2 : 0;
    ctx.translate(0, bob);

    var r = Math.min(cellW, cellH) * 0.28;
    var isBad = h.type === "bad";
    var isGold = h.type === "gold";

    if (isBad) {
      ctx.fillStyle = "#595959";
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.4); ctx.lineTo(-r * 0.9, -r * 1.1); ctx.lineTo(-r * 0.2, -r * 0.7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 0.9, -r * 1.1); ctx.lineTo(r * 0.2, -r * 0.7);
      ctx.fill();
    } else {
      ctx.fillStyle = isGold ? "#ffa940" : "#d48806";
      ctx.beginPath(); ctx.arc(-r * 0.75, -r * 0.65, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.75, -r * 0.65, r * 0.32, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#ffadd2";
      ctx.beginPath(); ctx.arc(-r * 0.75, -r * 0.65, r * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.75, -r * 0.65, r * 0.18, 0, Math.PI * 2); ctx.fill();
    }

    var headGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.1);
    if (isBad) {
      headGrad.addColorStop(0, "#8c8c8c");
      headGrad.addColorStop(1, "#434343");
    } else if (isGold) {
      headGrad.addColorStop(0, "#fff1b8");
      headGrad.addColorStop(1, "#ffc53d");
    } else {
      headGrad.addColorStop(0, "#ffe7ba");
      headGrad.addColorStop(1, "#fa8c16");
    }
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    if (!isBad) {
      ctx.fillStyle = "#fff1b8";
      ctx.beginPath();
      ctx.ellipse(0, r * 0.28, r * 0.65, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 120, 117, 0.55)";
      ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.15, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.55, r * 0.15, r * 0.2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "#262626";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (squish > 0.4) {
      ctx.strokeStyle = isBad ? "#ff4d4f" : "#262626";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.25); ctx.lineTo(-r * 0.2, -r * 0.05);
      ctx.moveTo(-r * 0.2, -r * 0.25); ctx.lineTo(-r * 0.45, -r * 0.05);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.2, -r * 0.25); ctx.lineTo(r * 0.45, -r * 0.05);
      ctx.moveTo(r * 0.45, -r * 0.25); ctx.lineTo(r * 0.2, -r * 0.05);
      ctx.stroke();
    } else {
      ctx.fillStyle = isBad ? "#ff4d4f" : "#1f1f1f";
      ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.32, -r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.2, r * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.2, r * 0.06, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = isBad ? "#141414" : "#ff85c0";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isGold) {
      ctx.fillStyle = "#fff0f6";
      ctx.font = (r * 0.8) + "px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("👑", 0, -r * 0.85);
    }

    ctx.restore();
  }

  function renderGame() {
    var vw = canvas.width;
    var vh = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    var bgGrad = ctx.createLinearGradient(0, 0, 0, vh);
    bgGrad.addColorStop(0, "#91d5ff");
    bgGrad.addColorStop(0.25, "#bae7ff");
    bgGrad.addColorStop(0.27, "#73d13d");
    bgGrad.addColorStop(1, "#278003");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, vw, vh);

    ctx.setTransform(
      scale, 0, 0, scale,
      offX + (Math.random() - 0.5) * shake * 10 * scale,
      offY + (Math.random() - 0.5) * shake * 10 * scale
    );

    ctx.fillStyle = "#432b16";
    roundRectPath(W * 0.04, gridTop - 25, W * 0.92, (gridBot - gridTop) + 50, 24);
    ctx.fill();

    ctx.fillStyle = "#5c3c1e";
    roundRectPath(W * 0.05, gridTop - 20, W * 0.9, (gridBot - gridTop) + 40, 20);
    ctx.fill();

    for (var i = 0; i < holes.length; i++) drawHole(holes[i]);
    for (var j = 0; j < holes.length; j++) drawCreature(holes[j]);

    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.font = "700 20px Fredoka, sans-serif";
    for (var u = 0; u < popups.length; u++) {
      ctx.globalAlpha = Math.max(0, popups[u].life);
      ctx.fillStyle = popups[u].color;
      ctx.fillText(popups[u].text, popups[u].x, popups[u].y);
    }
    ctx.globalAlpha = 1;

    if (flashRed > 0) {
      ctx.fillStyle = "rgba(255,77,79," + (flashRed * 0.3) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    if (tierFlash > 0) {
      ctx.globalAlpha = Math.min(1, tierFlash * 1.8);
      ctx.font = "700 26px Fredoka, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#389e0d";
      ctx.lineWidth = 4;
      var tierName = TIERS[tier].name;
      ctx.strokeText(tierName, W / 2, H * 0.1);
      ctx.fillText(tierName, W / 2, H * 0.1);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* --------------------------------------------------------------------------
     9. Main RequestAnimationFrame Loop
     -------------------------------------------------------------------------- */
  var lastTs = 0;
  function gameLoop(ts) {
    requestAnimationFrame(gameLoop);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (state === STATE_PLAY) {
      stepGame(dt);
    } else if (state === STATE_TITLE) {
      ambientStep(dt);
    }

    renderGame();
  }

  /* --------------------------------------------------------------------------
     10. UI & Flow State Management
     -------------------------------------------------------------------------- */
  function startGame() {
    initAudio();
    startBgm();
    resetGame();
    state = STATE_PLAY;

    titleScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    hudEl.classList.remove("hidden");
    lastTs = 0;
  }

  function showGameOverScreen() {
    state = STATE_OVER;
    stopBgm();

    if (score > bestScore) {
      bestScore = score;
      try {
        localStorage.setItem("whack_best_score", String(bestScore));
      } catch (e) {}
      bestScoreText.textContent = bestScore + " (NEW RECORD!) 🎉";
    } else {
      bestScoreText.textContent = String(bestScore);
    }

    var lines = ["Nice Try! 🎉", "Good Effort! 🌟", "So Close! 👍", "Great Run! ⭐"];
    overTitle.textContent = lines[(Math.random() * lines.length) | 0];
    overReasonText.textContent = gameOverReason;
    finalScoreText.textContent = score;
    whackedText.textContent = whacked + " Whacked";
    bestStreakText.textContent = "Streak " + bestStreak;

    hudEl.classList.add("hidden");
    gameOverScreen.classList.remove("hidden");
  }

  function pauseGame() {
    if (state !== STATE_PLAY) return;
    state = STATE_PAUSED;
    stopBgm();
    pauseScreen.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== STATE_PAUSED) return;
    state = STATE_PLAY;
    startBgm();
    pauseScreen.classList.add("hidden");
    lastTs = 0;
  }

  // Event Listeners for UI Buttons
  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    startGame();
  });

  againBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    startGame();
  });

  resumeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    resumeGame();
  });

  function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX = e.clientX;
    var clientY = e.clientY;

    if (typeof clientX !== "number" && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    var cssX = clientX - rect.left;
    var cssY = clientY - rect.top;

    return {
      x: (((cssX * dpr) - offX) / scale),
      y: (((cssY * dpr) - offY) / scale)
    };
  }

  if (window.PointerEvent) {
    canvas.addEventListener("pointerdown", function (e) {
      if (state !== STATE_PLAY) return;
      var coords = getCanvasCoords(e);
      tapAt(coords.x, coords.y);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  } else {
    canvas.addEventListener("touchstart", function (e) {
      if (state !== STATE_PLAY) return;
      if (e.changedTouches) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var coords = getCanvasCoords(e.changedTouches[i]);
          tapAt(coords.x, coords.y);
        }
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("mousedown", function (e) {
      if (state !== STATE_PLAY) return;
      var coords = getCanvasCoords(e);
      tapAt(coords.x, coords.y);
      if (e.cancelable) e.preventDefault();
    });
  }

  window.addEventListener("keydown", function (e) {
    if ((e.key === " " || e.key === "Enter") && state !== STATE_PLAY && state !== STATE_PAUSED) {
      startGame();
    } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (state === STATE_PLAY) pauseGame();
      else if (state === STATE_PAUSED) resumeGame();
    }
  });

  /* --------------------------------------------------------------------------
     11. Auto-Pause on Window Blur / Tab Close / Visibility Change
     -------------------------------------------------------------------------- */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === STATE_PLAY) {
      pauseGame();
    }
  });

  window.addEventListener("blur", function () {
    if (state === STATE_PLAY) {
      pauseGame();
    }
  });

  window.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  /* --------------------------------------------------------------------------
     12. Engine Boot
     -------------------------------------------------------------------------- */
  resize();
  resetGame();
  requestAnimationFrame(gameLoop);

})();
