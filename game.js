// Game Configuration
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRAVITY: 0.6,
    FRICTION: 0.8,
    PLAYER_SIZE: 32,
    TILE_SIZE: 40,
    DAY_DURATION: 600, // frames for full day (10 seconds at 60fps)
};

// Character Stats
const CHARACTERS = {
    mario: {
        name: 'Mario',
        color: '#FF0000',
        speed: 5,
        jumpPower: 13,
    },
    luigi: {
        name: 'Luigi',
        color: '#00AA00',
        speed: 4,
        jumpPower: 15,
    },
    noura: {
        name: 'Noura',
        color: '#FF1493',
        speed: 5.5,
        jumpPower: 14,
    }
};

// Game State
const game = {
    canvas: null,
    ctx: null,
    player: null,
    currentLevel: 1,
    score: 0,
    coins: 0,
    lives: 3,
    selectedCharacter: 'mario',
    gameState: 'start', // start, playing, win, lose
    keys: {},
    camera: { x: 0, y: 0 },
    objects: [],
    enemies: [],
    particles: [],
    isNightMode: false, // false = day, true = night
};

// Player Class
class Player {
    constructor(x, y, character) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER_SIZE;
        this.height = CONFIG.PLAYER_SIZE;
        this.vx = 0;
        this.vy = 0;
        this.character = CHARACTERS[character];
        this.onGround = false;
        this.direction = 1; // 1 = right, -1 = left
    }

    update() {
        // Horizontal movement
        if (game.keys['ArrowLeft'] || game.keys['a']) {
            this.vx = -this.character.speed;
            this.direction = -1;
        } else if (game.keys['ArrowRight'] || game.keys['d']) {
            this.vx = this.character.speed;
            this.direction = 1;
        } else {
            this.vx *= CONFIG.FRICTION;
        }

        // Jumping
        if ((game.keys['ArrowUp'] || game.keys['w'] || game.keys[' ']) && this.onGround) {
            this.vy = -this.character.jumpPower;
            this.onGround = false;
        }

        // Apply gravity
        this.vy += CONFIG.GRAVITY;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Check collisions
        this.onGround = false;
        this.checkCollisions();

        // Keep player in bounds (left and right)
        if (this.x < 0) this.x = 0;

        // Death by falling
        if (this.y > CONFIG.CANVAS_HEIGHT + 100) {
            game.lives--;
            if (game.lives <= 0) {
                showScreen('lose');
            } else {
                resetLevel();
            }
        }
    }

    checkCollisions() {
        for (let obj of game.objects) {
            if (obj.type === 'platform' && this.intersects(obj)) {
                // Determine collision side
                const overlapLeft = (this.x + this.width) - obj.x;
                const overlapRight = (obj.x + obj.width) - this.x;
                const overlapTop = (this.y + this.height) - obj.y;
                const overlapBottom = (obj.y + obj.height) - this.y;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapTop && this.vy > 0) {
                    // Landing on platform
                    this.y = obj.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                } else if (minOverlap === overlapBottom && this.vy < 0) {
                    // Hitting platform from below
                    this.y = obj.y + obj.height;
                    this.vy = 0;
                } else if (minOverlap === overlapLeft) {
                    this.x = obj.x - this.width;
                    this.vx = 0;
                } else if (minOverlap === overlapRight) {
                    this.x = obj.x + obj.width;
                    this.vx = 0;
                }
            } else if (obj.type === 'coin' && !obj.collected && this.intersects(obj)) {
                obj.collected = true;
                game.coins++;
                game.score += 100;
                createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, '#FFD700');
                updateUI();
            } else if (obj.type === 'goal' && this.intersects(obj)) {
                levelComplete();
            }
        }

        // Enemy collisions
        for (let enemy of game.enemies) {
            if (!enemy.dead && this.intersects(enemy)) {
                // Check if player jumped on enemy
                if (this.vy > 0 && this.y + this.height - enemy.y < 15) {
                    enemy.dead = true;
                    this.vy = -8;
                    game.score += 200;
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#FF0000');
                    updateUI();
                } else {
                    // Player hit by enemy
                    game.lives--;
                    createParticles(this.x + this.width / 2, this.y + this.height / 2, this.character.color);
                    if (game.lives <= 0) {
                        showScreen('lose');
                    } else {
                        resetLevel();
                    }
                }
            }
        }
    }

    intersects(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    draw(ctx) {
        const x = this.x - game.camera.x;
        const y = this.y - game.camera.y;

        // Draw player shadow (ellipse)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + this.width/2, y + this.height + 2, this.width/2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Helper function for rounded rectangle
        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
        };

        // Main body (shirt/dress for Noura)
        const bodyColor = this.character.name === 'Noura' ? '#FFD700' : '#0000FF';
        ctx.fillStyle = bodyColor;
        roundRect(x + 6, y + 16, this.width - 12, 16, 4);

        // Head (rounded)
        ctx.fillStyle = '#FFDBAC';
        ctx.beginPath();
        ctx.arc(x + this.width/2, y + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        // Hat/Hair
        ctx.fillStyle = this.character.color;
        ctx.beginPath();
        ctx.arc(x + this.width/2, y + 8, 9, Math.PI, 0, true);
        ctx.fill();

        // Hat brim
        ctx.fillStyle = this.character.color;
        roundRect(x + 6, y + 8, this.width - 12, 3, 1);

        // Eyes
        ctx.fillStyle = '#FFF';
        if (this.direction === 1) {
            ctx.beginPath();
            ctx.arc(x + 18, y + 10, 2.5, 0, Math.PI * 2);
            ctx.arc(x + 24, y + 10, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Pupils
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x + 19, y + 10, 1.5, 0, Math.PI * 2);
            ctx.arc(x + 25, y + 10, 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(x + 8, y + 10, 2.5, 0, Math.PI * 2);
            ctx.arc(x + 14, y + 10, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Pupils
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x + 7, y + 10, 1.5, 0, Math.PI * 2);
            ctx.arc(x + 13, y + 10, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + this.width/2, y + 11, 3, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Arms (rounded)
        ctx.fillStyle = '#FFDBAC';
        ctx.beginPath();
        ctx.arc(x + 4, y + 20, 3, 0, Math.PI * 2);
        ctx.arc(x + this.width - 4, y + 20, 3, 0, Math.PI * 2);
        ctx.fill();

        // Legs (rounded)
        ctx.fillStyle = this.character.color;
        roundRect(x + 10, y + 26, 4, 6, 2);
        roundRect(x + 18, y + 26, 4, 6, 2);

        // Shoes
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(x + 12, y + 32, 3, 2, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 20, y + 32, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Special feature for Noura - hair bow
        if (this.character.name === 'Noura') {
            ctx.fillStyle = '#FF1493';
            ctx.beginPath();
            ctx.arc(x + this.width/2 - 6, y + 6, 3, 0, Math.PI * 2);
            ctx.arc(x + this.width/2 + 6, y + 6, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, speed = 1) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = speed;
        this.direction = -1;
        this.dead = false;
        this.vy = 0;
    }

    update() {
        if (this.dead) return;

        // Apply gravity
        this.vy += CONFIG.GRAVITY;
        this.y += this.vy;

        // Platform collision for enemies
        let currentPlatform = null;
        for (let obj of game.objects) {
            if (obj.type === 'platform' && this.intersects(obj)) {
                if (this.vy > 0) {
                    this.y = obj.y - this.height;
                    this.vy = 0;
                    currentPlatform = obj;
                }
            }
        }

        // Check if enemy would walk off edge of current platform
        if (currentPlatform) {
            const nextX = this.x + this.speed * this.direction;
            const enemyLeft = nextX;
            const enemyRight = nextX + this.width;
            const platformLeft = currentPlatform.x;
            const platformRight = currentPlatform.x + currentPlatform.width;

            // Turn around if about to walk off edge
            if (enemyRight > platformRight || enemyLeft < platformLeft) {
                this.direction *= -1;
            }
        }

        // Move horizontally
        this.x += this.speed * this.direction;

        // Check for wall collisions (hitting other platforms from side)
        for (let obj of game.objects) {
            if (obj.type === 'platform' && this.intersects(obj)) {
                const overlapLeft = (this.x + this.width) - obj.x;
                const overlapRight = (obj.x + obj.width) - this.x;

                if (overlapLeft < overlapRight && overlapLeft < 10) {
                    // Hit from left side
                    this.x = obj.x - this.width;
                    this.direction = -1;
                } else if (overlapRight < overlapLeft && overlapRight < 10) {
                    // Hit from right side
                    this.x = obj.x + obj.width;
                    this.direction = 1;
                }
            }
        }
    }

    intersects(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    draw(ctx) {
        if (this.dead) return;

        const x = this.x - game.camera.x;
        const y = this.y - game.camera.y;

        // Helper function for rounded rectangle
        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
        };

        // Body (rounded)
        ctx.fillStyle = '#8B4513';
        roundRect(x + 2, y + 4, this.width - 4, this.height - 4, 6);

        // Eyes (rounded white background)
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(x + 10, y + 12, 4, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 12, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + 11, y + 12, 2, 0, Math.PI * 2);
        ctx.arc(x + 21, y + 12, 2, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 7, y + 9);
        ctx.lineTo(x + 13, y + 11);
        ctx.moveTo(x + 17, y + 11);
        ctx.lineTo(x + 23, y + 9);
        ctx.stroke();

        // Feet (rounded)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(x + 9, y + this.height - 3, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 21, y + this.height - 3, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Particle System
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        game.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 30,
            color: color
        });
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
        if (p.life <= 0) {
            game.particles.splice(i, 1);
        }
    }
}

function drawParticles(ctx) {
    for (let p of game.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.fillRect(p.x - game.camera.x, p.y - game.camera.y, 4, 4);
        ctx.globalAlpha = 1;
    }
}

// Level Data
const LEVELS = {
    1: {
        playerStart: { x: 50, y: 400 },
        objects: [
            // Ground
            { type: 'platform', x: 0, y: 550, width: 800, height: 50, color: '#8B4513' },
            { type: 'platform', x: 800, y: 550, width: 400, height: 50, color: '#8B4513' },
            { type: 'platform', x: 1200, y: 550, width: 600, height: 50, color: '#8B4513' },

            // Platforms
            { type: 'platform', x: 300, y: 450, width: 150, height: 20, color: '#228B22' },
            { type: 'platform', x: 550, y: 350, width: 150, height: 20, color: '#228B22' },
            { type: 'platform', x: 800, y: 450, width: 150, height: 20, color: '#228B22' },
            { type: 'platform', x: 1050, y: 350, width: 150, height: 20, color: '#228B22' },
            { type: 'platform', x: 1300, y: 450, width: 150, height: 20, color: '#228B22' },
            { type: 'platform', x: 1500, y: 350, width: 150, height: 20, color: '#228B22' },

            // Coins
            { type: 'coin', x: 350, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 380, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 600, y: 310, width: 20, height: 20, collected: false },
            { type: 'coin', x: 850, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 880, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1100, y: 310, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1350, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1550, y: 310, width: 20, height: 20, collected: false },

            // Goal
            { type: 'goal', x: 1700, y: 450, width: 40, height: 100 }
        ],
        enemies: [
            { x: 320, y: 420, speed: 1.5 },
            { x: 820, y: 420, speed: 1.5 },
            { x: 1320, y: 420, speed: 2 }
        ]
    },
    2: {
        playerStart: { x: 50, y: 400 },
        objects: [
            // Ground (with gaps)
            { type: 'platform', x: 0, y: 550, width: 400, height: 50, color: '#8B4513' },
            { type: 'platform', x: 600, y: 550, width: 300, height: 50, color: '#8B4513' },
            { type: 'platform', x: 1100, y: 550, width: 300, height: 50, color: '#8B4513' },
            { type: 'platform', x: 1600, y: 550, width: 500, height: 50, color: '#8B4513' },

            // Floating platforms
            { type: 'platform', x: 200, y: 450, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 450, y: 380, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 700, y: 450, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 950, y: 350, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 1200, y: 450, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 1450, y: 380, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 1700, y: 300, width: 120, height: 20, color: '#228B22' },
            { type: 'platform', x: 1900, y: 450, width: 120, height: 20, color: '#228B22' },

            // Coins
            { type: 'coin', x: 240, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 270, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 490, y: 340, width: 20, height: 20, collected: false },
            { type: 'coin', x: 740, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 990, y: 310, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1240, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1490, y: 340, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1740, y: 260, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1940, y: 410, width: 20, height: 20, collected: false },
            { type: 'coin', x: 1970, y: 410, width: 20, height: 20, collected: false },

            // Goal
            { type: 'goal', x: 2000, y: 450, width: 40, height: 100 }
        ],
        enemies: [
            { x: 220, y: 420, speed: 1 },
            { x: 720, y: 420, speed: 1.5 },
            { x: 970, y: 320, speed: 1 },
            { x: 1220, y: 420, speed: 2 },
            { x: 1920, y: 420, speed: 1.5 }
        ]
    }
};

// Initialize Game
function init() {
    game.canvas = document.getElementById('game-canvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = CONFIG.CANVAS_WIDTH;
    game.canvas.height = CONFIG.CANVAS_HEIGHT;

    setupEventListeners();
}

function setupEventListeners() {
    // Character selection
    document.querySelectorAll('.character-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            game.selectedCharacter = e.currentTarget.dataset.character;
            startGame();
        });
    });

    // Game buttons
    document.getElementById('continue-btn').addEventListener('click', () => {
        if (game.currentLevel === 1) {
            game.currentLevel = 2;
            loadLevel(2);
            showScreen('playing');
            gameLoop();
        } else {
            // Game complete
            document.getElementById('win-message').textContent = 'You Won the Game!';
            document.getElementById('continue-btn').style.display = 'none';
        }
    });

    document.getElementById('restart-win-btn').addEventListener('click', () => {
        game.currentLevel = 1;
        game.score = 0;
        game.coins = 0;
        game.lives = 3;
        showScreen('start');
    });

    document.getElementById('retry-btn').addEventListener('click', () => {
        game.lives = 3;
        resetLevel();
        showScreen('playing');
        gameLoop();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        game.currentLevel = 1;
        game.score = 0;
        game.coins = 0;
        game.lives = 3;
        showScreen('start');
    });

    // Day/Night toggle
    document.getElementById('day-night-toggle').addEventListener('click', () => {
        game.isNightMode = !game.isNightMode;
        const icon = document.getElementById('toggle-icon');
        icon.textContent = game.isNightMode ? '🌙' : '☀️';
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        game.keys[e.key] = true;
    });

    window.addEventListener('keyup', (e) => {
        game.keys[e.key] = false;
    });
}

function startGame() {
    game.currentLevel = 1;
    game.score = 0;
    game.coins = 0;
    game.lives = 3;
    loadLevel(1);
    showScreen('playing');
    gameLoop();
}

function loadLevel(levelNum) {
    const level = LEVELS[levelNum];
    game.objects = JSON.parse(JSON.stringify(level.objects));
    game.enemies = level.enemies.map(e => new Enemy(e.x, e.y, e.speed));
    game.player = new Player(level.playerStart.x, level.playerStart.y, game.selectedCharacter);
    game.camera.x = 0;
    game.particles = [];
    updateUI();
}

function resetLevel() {
    loadLevel(game.currentLevel);
    updateUI();
}

function levelComplete() {
    game.score += 1000;
    document.getElementById('final-score').textContent = `Score: ${game.score}`;

    if (game.currentLevel === 1) {
        document.getElementById('win-message').textContent = 'Level 1 Complete!';
        document.getElementById('continue-btn').style.display = 'inline-block';
    } else {
        document.getElementById('win-message').textContent = 'You Won the Game!';
        document.getElementById('continue-btn').style.display = 'none';
    }

    showScreen('win');
}

function showScreen(screen) {
    game.gameState = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    switch(screen) {
        case 'start':
            document.getElementById('start-screen').classList.add('active');
            break;
        case 'playing':
            document.getElementById('game-screen').classList.add('active');
            break;
        case 'win':
            document.getElementById('win-screen').classList.add('active');
            break;
        case 'lose':
            document.getElementById('lose-score').textContent = `Score: ${game.score}`;
            document.getElementById('lose-screen').classList.add('active');
            break;
    }
}

function updateUI() {
    document.getElementById('character-name').textContent = CHARACTERS[game.selectedCharacter].name;
    document.getElementById('lives').textContent = `❤️ x ${game.lives}`;
    document.getElementById('level-display').textContent = `Level ${game.currentLevel}`;
    document.getElementById('score').textContent = `Score: ${game.score}`;
    document.getElementById('coins').textContent = `🪙 x ${game.coins}`;
}

function updateCamera() {
    // Camera follows player
    const targetX = game.player.x - CONFIG.CANVAS_WIDTH / 3;
    game.camera.x = Math.max(0, targetX);
}

function getSkyColors(isNight) {
    if (isNight) {
        // Night - dark blue/purple
        return {
            top: '#1a1a2e',
            bottom: '#0f0f1e',
            isNight: true
        };
    } else {
        // Day - bright blue
        return {
            top: '#87CEEB',
            bottom: '#E0F6FF',
            isNight: false
        };
    }
}

function gameLoop() {
    if (game.gameState !== 'playing') return;

    // Update
    game.player.update();
    game.enemies.forEach(e => e.update());
    updateParticles();
    updateCamera();

    // Draw
    const ctx = game.ctx;

    // Get current sky colors based on day/night mode
    const skyColors = getSkyColors(game.isNightMode);

    // Sky background with day/night cycle
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
    gradient.addColorStop(0, skyColors.top);
    gradient.addColorStop(1, skyColors.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Draw sun or moon (static position in top right)
    const celestialX = CONFIG.CANVAS_WIDTH - 100;
    const celestialY = 80;

    if (skyColors.isNight) {
        // Draw moon
        ctx.fillStyle = '#F0F0F0';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 25, 0, Math.PI * 2);
        ctx.fill();
        // Moon craters
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath();
        ctx.arc(celestialX - 8, celestialY - 5, 5, 0, Math.PI * 2);
        ctx.arc(celestialX + 6, celestialY + 4, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw stars
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 50; i++) {
            const starX = (i * 123) % CONFIG.CANVAS_WIDTH;
            const starY = (i * 456) % (CONFIG.CANVAS_HEIGHT / 2);
            const twinkle = Math.sin(Date.now() * 0.003 + i) * 0.5 + 0.5;
            ctx.globalAlpha = twinkle;
            ctx.fillRect(starX, starY, 2, 2);
        }
        ctx.globalAlpha = 1;
    } else {
        // Draw sun
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFA500';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Draw clouds (lighter at night)
    const cloudOpacity = skyColors.isNight ? 0.2 : 0.6;
    ctx.fillStyle = `rgba(255, 255, 255, ${cloudOpacity})`;
    for (let i = 0; i < 5; i++) {
        const cloudX = (i * 400 - game.camera.x * 0.3) % (CONFIG.CANVAS_WIDTH + 200);
        ctx.beginPath();
        ctx.arc(cloudX, 80 + i * 30, 30, 0, Math.PI * 2);
        ctx.arc(cloudX + 30, 80 + i * 30, 40, 0, Math.PI * 2);
        ctx.arc(cloudX + 60, 80 + i * 30, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw objects
    game.objects.forEach(obj => {
        if (obj.type === 'platform') {
            ctx.fillStyle = obj.color;
            ctx.fillRect(obj.x - game.camera.x, obj.y - game.camera.y, obj.width, obj.height);
            // Add texture
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            for (let i = 0; i < obj.width; i += 20) {
                ctx.fillRect(obj.x - game.camera.x + i, obj.y - game.camera.y, 1, obj.height);
            }
        } else if (obj.type === 'coin' && !obj.collected) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(obj.x - game.camera.x + obj.width/2, obj.y - game.camera.y + obj.height/2, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (obj.type === 'goal') {
            // Draw flagpole
            ctx.fillStyle = '#333';
            ctx.fillRect(obj.x - game.camera.x + 15, obj.y - game.camera.y, 5, obj.height);
            // Draw flag
            ctx.fillStyle = '#00FF00';
            ctx.beginPath();
            ctx.moveTo(obj.x - game.camera.x + 20, obj.y - game.camera.y + 10);
            ctx.lineTo(obj.x - game.camera.x + 50, obj.y - game.camera.y + 20);
            ctx.lineTo(obj.x - game.camera.x + 20, obj.y - game.camera.y + 30);
            ctx.fill();
        }
    });

    // Draw enemies
    game.enemies.forEach(e => e.draw(ctx));

    // Draw particles
    drawParticles(ctx);

    // Draw player
    game.player.draw(ctx);

    requestAnimationFrame(gameLoop);
}

// Start the game
init();
