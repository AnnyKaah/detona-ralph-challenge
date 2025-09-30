const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const GAME_WIDTH = canvas.width;

const startButton = document.getElementById('start-button');
const welcomeScreen = document.getElementById('welcome-screen');
const restartButton = document.getElementById('restart-button');
const gamePanel = document.getElementById('game-panel');
const gameOverPanel = document.getElementById('game-over');
const finalScoreDisplay = document.getElementById('final-score');
const highScoreDisplay = document.getElementById('high-score-display');
const loadingText = document.getElementById('loading-text');
const highScoreGameOverDisplay = document.getElementById('high-score-game-over');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const muteButton = document.getElementById('mute-button');
const flashOverlay = document.getElementById('flash-overlay');

// --- Configurações do Jogo ---
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 80;
const PLAYER_SPEED = 5;
const PLAYER_HITBOX_PADDING = 10; // Reduz a hitbox em 10px de cada lado
const MAX_LIVES = 5;
const INITIAL_LIVES = 3;

const ENEMY_WIDTH = 50;
const ENEMY_HEIGHT = 80;
const INITIAL_ENEMY_SPEED = 3;

const RALPH_WIDTH = 80;
const RALPH_HEIGHT = 100;
const RALPH_SPEED = 2;

const POWERUP_WIDTH = 40;
const POWERUP_HEIGHT = 40;
const POWERUP_SPEED = 3;

// --- Estado do Jogo ---
const gameState = {
  score: 0,
  lives: INITIAL_LIVES,
  gameRunning: false,
  highScore: 0,
};

let animationFrameId;
let enemies = [];
let powerUp = null;
const floatingTexts = [];

// --- Imagens do Jogo ---
const playerImg = new Image();
const enemyImg = new Image();
const ralphImg = new Image();
const ralphThrowImg = new Image();
const powerUpImg = new Image();

const backgroundImg = new Image(); // Adicionamos a imagem do prédio de volta

const assets = [
  { img: playerImg, src: 'assets/felix.png' },
  { img: enemyImg, src: 'assets/brick.png' },
  { img: ralphImg, src: 'assets/ralph.png' },
  { img: ralphThrowImg, src: 'assets/ralph-throw.png' },
  { img: powerUpImg, src: 'assets/pie.png' },
  { img: backgroundImg, src: 'assets/building.png' },
];

function loadAssets() {
  startButton.style.display = 'none';
  loadingText.textContent = 'Carregando...';

  const promises = assets.map(asset => {
    return new Promise((resolve, reject) => {
      asset.img.onload = () => resolve(asset.src);
      asset.img.onerror = () => reject(asset.src);
      asset.img.src = asset.src;
    });
  });

  Promise.all(promises)
    .then(() => {
      console.log("Todos os recursos foram carregados com sucesso!");
      loadingText.style.display = 'none';
      startButton.style.display = 'block';
    })
    .catch(failedAsset => {
      console.error(`ERRO CRÍTICO: Não foi possível carregar o recurso '${failedAsset}'. O jogo não pode iniciar.`);
      loadingText.textContent = `Erro ao carregar asset: ${failedAsset}`;
      loadingText.style.color = '#e74c3c';
    });
}

const throwSound = new Audio('assets/fix.mp3');
throwSound.volume = 0.5;

const damageSound = new Audio('assets/damage.mp3');
damageSound.volume = 0.7;

const extraLifeSound = new Audio('assets/extra-life.mp3');
extraLifeSound.volume = 0.7;

const powerUpSound = new Audio('assets/powerup.mp3');
powerUpSound.volume = 0.6;

const backgroundMusic = new Audio('assets/background-music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

const player = {
  x: 0,
  y: canvas.height - PLAYER_HEIGHT - 20,
  width: PLAYER_WIDTH,
  height: PLAYER_HEIGHT,
  speed: PLAYER_SPEED,
  dx: 0,
  isInvincible: false,
  invincibilityTimer: 0,
};

const ralph = {
  x: GAME_WIDTH / 2,
  y: 10,
  width: RALPH_WIDTH,
  height: RALPH_HEIGHT,
  speed: RALPH_SPEED,
  dx: RALPH_SPEED,
  isThrowing: false,
  throwTimer: 0,
};

function resetPlayer() {
  player.x = 50;
  player.dx = 0;
  player.isInvincible = false;
  player.invincibilityTimer = 0;
}

function spawnEnemy() {
  throwSound.play().catch(e => console.error("Erro ao tocar som:", e));

  ralph.isThrowing = true;
  ralph.throwTimer = 30; // Duração da animação em frames (aprox. 0.5s)

  let newEnemy;
  const enemyTypeRoll = Math.random();
  const startX = ralph.x + (ralph.width / 2) - (ENEMY_WIDTH / 2);
  const startY = ralph.y + ralph.height - 30;
  const baseSpeed = INITIAL_ENEMY_SPEED + (gameState.score / 15);

  if (enemyTypeRoll < 0.6) { // 60% de chance de ser um tijolo normal
    newEnemy = { type: 'normal', x: startX, y: startY, width: ENEMY_WIDTH, height: ENEMY_HEIGHT, speed: baseSpeed };
  } else if (enemyTypeRoll < 0.85) { // 25% de chance de ser um tijolo rápido
    newEnemy = { type: 'fast', x: startX, y: startY, width: ENEMY_WIDTH * 0.8, height: ENEMY_HEIGHT * 0.8, speed: baseSpeed * 1.5 };
  } else { // 15% de chance de ser um tijolo ondulante
    newEnemy = {
      type: 'wavy',
      x: startX,
      y: startY,
      width: ENEMY_WIDTH,
      height: ENEMY_HEIGHT,
      speed: baseSpeed * 0.9,
      startX: startX, // Posição X original para calcular a onda
      waveFrequency: 0.02,
      waveAmplitude: 40,
    };
  }

  enemies.push(newEnemy);
}

function spawnPowerUp() {
  if (!powerUp) {
    powerUp = {
      x: Math.random() * (GAME_WIDTH - POWERUP_WIDTH),
      y: -POWERUP_HEIGHT,
      width: POWERUP_WIDTH,
      height: POWERUP_HEIGHT,
      speed: POWERUP_SPEED,
    };
  }
}

function addScore(points) {
  const oldScore = gameState.score;
  gameState.score += points;
  scoreDisplay.textContent = `PONTOS: ${gameState.score}`;

  // A cada 25 pontos (tijolos desviados), ganha uma vida, até o máximo de 5.
  const lifeUpThreshold = 25;
  if (Math.floor(oldScore / lifeUpThreshold) < Math.floor(gameState.score / lifeUpThreshold)) {
    if (gameState.lives < MAX_LIVES) {
      gameState.lives++;
      livesDisplay.textContent = `VIDAS: ${gameState.lives}`;
      extraLifeSound.play().catch(e => console.error("Erro ao tocar som de vida extra:", e));
      floatingTexts.push({
        text: '+1 LIFE',
        x: player.x + player.width / 2,
        y: player.y,
        timer: 60, // Duração em frames (1 segundo a 60fps)
      });
    }
  }
}

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updatePlayer() {
  player.x += player.dx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > GAME_WIDTH) player.x = GAME_WIDTH - player.width;
  
  if (player.isInvincible) {
    player.invincibilityTimer--;
    if (player.invincibilityTimer <= 0) {
      player.isInvincible = false;
    }
  }
}

function updateRalph() {
  ralph.x += ralph.dx;
  if (ralph.x + ralph.width > GAME_WIDTH || ralph.x < 0) {
    ralph.dx *= -1;
  }
  if (ralph.isThrowing) {
    ralph.throwTimer--;
    if (ralph.throwTimer <= 0) {
      ralph.isThrowing = false;
    }
  }
}

function updateEnemies() {
  for (const enemy of enemies) {
    enemy.y += enemy.speed;

    if (enemy.type === 'wavy') {
      enemy.x = enemy.startX + Math.sin(enemy.y * enemy.waveFrequency) * enemy.waveAmplitude;
    }
  }
}

function updateEffects() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const txt = floatingTexts[i];
    txt.y -= 0.5;
    txt.timer--;

    if (txt.timer <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

function updateEntities() {
  // Adiciona um novo inimigo aleatoriamente para manter o desafio
  if (Math.random() < 0.015 + (gameState.score / 5000)) {
    spawnEnemy();
  }

  if (powerUp) {
    powerUp.y += powerUp.speed;

    if (
      player.x < powerUp.x + powerUp.width &&
      player.x + player.width > powerUp.x &&
      player.y < powerUp.y + powerUp.height &&
      player.y + player.height > powerUp.y
    ) {
      powerUpSound.play().catch(e => console.error("Erro ao tocar som de power-up:", e));
      flashOverlay.classList.add('flash');
      setTimeout(() => {
        flashOverlay.classList.remove('flash');
      }, 300);
      enemies = [];
      addScore(5);
      powerUp = null;
    }

    if (powerUp && powerUp.y > canvas.height) {
      powerUp = null;
    }
  } else if (Math.random() < 0.001) { // Chance muito pequena de gerar um novo power-up
    spawnPowerUp();
  }
}

function handleCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const playerHitboxX = player.x + PLAYER_HITBOX_PADDING;
    const playerHitboxWidth = player.width - 2 * PLAYER_HITBOX_PADDING;

    if (
      playerHitboxX < enemy.x + enemy.width &&
      playerHitboxX + playerHitboxWidth > enemy.x &&
      player.y < enemy.y + enemy.height &&
      player.y + player.height > enemy.y &&
      !player.isInvincible // Só verifica a colisão se o jogador não estiver invencível
    ) {
      enemies.splice(i, 1);
      gameState.lives--;
      livesDisplay.textContent = `VIDAS: ${gameState.lives}`;

      damageSound.play().catch(e => console.error("Erro ao tocar som de dano:", e));

      canvas.classList.add('shake');
      setTimeout(() => {
        canvas.classList.remove('shake');
      }, 300); // A duração deve ser a mesma da animação em CSS

      player.isInvincible = true;
      player.invincibilityTimer = 120; // 120 frames = 2 segundos a 60fps

      if (gameState.lives <= 0) {
        endGame();
        return;
      }
      continue;
    }
  }
}

function drawGame() {
  clear();

  ctx.drawImage(backgroundImg, 0, 0, GAME_WIDTH, canvas.height);

  if (!player.isInvincible || player.invincibilityTimer % 10 < 5) {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  }

  ctx.drawImage(ralph.isThrowing ? ralphThrowImg : ralphImg, ralph.x, ralph.y, ralph.width, ralph.height);

  if (powerUp) {
    ctx.drawImage(powerUpImg, powerUp.x, powerUp.y, powerUp.width, powerUp.height);
  }

  for (const txt of floatingTexts) {
    ctx.save();
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillStyle = `rgba(39, 174, 96, ${txt.timer / 60})`; // Verde, desaparecendo
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(txt.text, txt.x, txt.y);
    ctx.restore();
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    ctx.drawImage(enemyImg, enemy.x, enemy.y, enemy.width, enemy.height);

    if (enemy.y > canvas.height) {
      enemies.splice(i, 1);
      addScore(1); // Ganha 1 ponto por tijolo desviado
    }
  }
}

function update() {
  updatePlayer();
  updateEnemies();
  updateRalph();
  updateEffects();
  updateEntities();
  handleCollisions();
  drawGame();
  
  if (gameState.gameRunning) {
    animationFrameId = requestAnimationFrame(update);
  }
}

let audioContext;
let gameOverBuffer;

function primeSounds() {
  if (audioContext) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Força o AudioContext a "acordar" e entrar no estado "rodando".
    // Isso é essencial para eliminar o atraso inicial.
    audioContext.resume();
  } catch (e) {
    console.error("Web Audio API não é suportada neste navegador.", e);
    return;
  }

  // Decodifica o som de Game Over antecipadamente
  fetch('assets/game-over.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
      gameOverBuffer = decodedAudio;
    }).catch(e => console.error("Falha ao decodificar áudio:", e));

  throwSound.load();
  damageSound.load();
  extraLifeSound.load();
  powerUpSound.load();
  backgroundMusic.load();
}

function startGame() {
  gameState.score = 0;
  gameState.lives = INITIAL_LIVES;
  enemies = [];
  powerUp = null;
  scoreDisplay.textContent = `PONTOS: ${gameState.score}`;
  livesDisplay.textContent = `VIDAS: ${gameState.lives}`;

  welcomeScreen.classList.add('hidden');
  gameOverPanel.classList.add('hidden');
  canvas.classList.remove('hidden');
  gamePanel.classList.remove('hidden');

  primeSounds();
  backgroundMusic.play().catch(e => console.error("Erro ao tocar música de fundo:", e));

  gameState.gameRunning = true;
  resetPlayer();
  ralph.x = GAME_WIDTH / 2; // Reseta a posição do Ralph
  spawnEnemy(); // Gera o primeiro inimigo
  update(); // Inicia o loop do jogo
}

function endGame() {
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0; // Reinicia a música para a próxima partida

  if (audioContext && gameOverBuffer) {
    const source = audioContext.createBufferSource();
    source.buffer = gameOverBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  }

  gameState.gameRunning = false;
  cancelAnimationFrame(animationFrameId);

  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    localStorage.setItem('highScore', gameState.highScore);
    highScoreDisplay.textContent = `Recorde: ${gameState.highScore}`;
    highScoreGameOverDisplay.textContent = `Novo Recorde: ${gameState.highScore}!`;
    highScoreGameOverDisplay.style.color = '#f39c12'; // Destaque para novo recorde
  } else {
    highScoreGameOverDisplay.textContent = `Recorde: ${gameState.highScore}`;
    highScoreGameOverDisplay.style.color = 'white';
  }

  finalScoreDisplay.textContent = `Sua pontuação final foi: ${gameState.score}`;
  gameOverPanel.classList.remove('hidden');
  canvas.classList.add('hidden');
  gamePanel.classList.add('hidden');
}

function loadHighScore() {
  gameState.highScore = Number(localStorage.getItem('highScore')) || 0;
  highScoreDisplay.textContent = `Recorde: ${gameState.highScore}`;
}

function initializeGame() {
  startButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);
  muteButton.addEventListener('click', () => {
    backgroundMusic.muted = !backgroundMusic.muted;
    muteButton.textContent = backgroundMusic.muted ? 'Música: OFF' : 'Música: ON';
  });

  document.addEventListener('keydown', (e) => {
    if (!gameState.gameRunning) return;
    if (e.key === 'ArrowRight' || e.key === 'd') player.dx = player.speed;
    else if (e.key === 'ArrowLeft' || e.key === 'a') player.dx = -player.speed;
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'ArrowLeft' || e.key === 'a') {
      player.dx = 0;
    }
  });

  // --- Eventos de Toque para Mobile ---
  canvas.addEventListener('touchstart', (e) => {
    if (!gameState.gameRunning) return;
    e.preventDefault();
    const touchX = e.touches[0].clientX - canvas.getBoundingClientRect().left;
    if (touchX < canvas.width / 2) {
      player.dx = -player.speed;
    } else {
      player.dx = player.speed;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!gameState.gameRunning) return;
    e.preventDefault();
    player.dx = 0;
  }, { passive: false });

  loadHighScore();
  loadAssets();
}

// Inicia o jogo quando a página estiver totalmente carregada
window.addEventListener('load', initializeGame);