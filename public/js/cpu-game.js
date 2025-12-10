class CPUGame {
    constructor() {
        // Get URL parameters
        this.params = new URLSearchParams(location.search);
        this.myName = decodeURIComponent(this.params.get('name') || 'Player');
        this.mySkin = Number(this.params.get('skin') || 0);
        
        // Game state
        this.sprites = null;
        this.gameState = {
            round: 1,
            timer: 10,
            timerInterval: null,
            isPlaying: false,
            playerScore: 0,
            cpuScore: 0
        };
        
        // CPU opponent
        this.cpu = {
            name: 'Computer 🤖',
            skin: (this.mySkin + 1) % 4,
            thinkingTime: 800
        };
        
        this.FIRST_TO = 5;
        
        // Initialize
        this.init();
    }

    async init() {
        console.log('Starting CPU game for:', this.myName);
        
        // Apply skin theme
        document.body.className = 'skin' + this.mySkin;
        
        // Update UI
        document.getElementById('roomLabel').textContent = 'Training Mode';
        document.body.classList.add('cpu-mode');
        
        // Update player names and status
        document.getElementById('p1Name').textContent = this.myName;
        document.getElementById('p1Status').textContent = 'You';
        document.getElementById('p2Name').textContent = this.cpu.name;
        document.getElementById('p2Status').textContent = 'Computer';
        
        // Update scores
        document.getElementById('p1Score').textContent = '0';
        document.getElementById('p2Score').textContent = '0';
        
        // Update round
        document.getElementById('roundNumber').textContent = '1';
        
        // Load sprites
        await this.loadSprites();
        
        // Set initial hand images
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        document.getElementById('p2Img').src = this.sprites[this.cpu.skin].rock;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start the game
        this.startGame();
    }

    async loadSprites() {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = '/assets/rps.png';
            
            img.onload = () => {
                const cols = 4, rows = 4;
                const cw = Math.floor(img.width / cols);
                const ch = Math.floor(img.height / rows);
                
                this.sprites = [];
                for (let col = 0; col < cols; col++) {
                    const skin = {};
                    skin.rock = this.cutSprite(img, col, 2, cw, ch);
                    skin.paper = this.cutSprite(img, col, 3, cw, ch);
                    skin.scissor = this.cutSprite(img, col, 0, cw, ch);
                    this.sprites.push(skin);
                }
                console.log('Sprites loaded successfully');
                resolve();
            };
            
            img.onerror = () => {
                console.log('Using fallback sprites');
                // Create simple colored shapes as fallback
                this.sprites = Array(4).fill().map((_, skinIndex) => {
                    const colors = [
                        ['#4fc3f7', '#0288d1'],
                        ['#ff7043', '#d84315'],
                        ['#66bb6a', '#388e3c'],
                        ['#7e57c2', '#512da8']
                    ];
                    
                    const [primary, secondary] = colors[skinIndex] || colors[0];
                    
                    return {
                        rock: this.createFallbackSVG('circle', primary),
                        paper: this.createFallbackSVG('square', primary),
                        scissor: this.createFallbackSVG('triangle', primary)
                    };
                });
                resolve();
            };
        });
    }

    createFallbackSVG(shape, color) {
        let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">';
        
        if (shape === 'circle') {
            svg += `<circle cx="50" cy="50" r="45" fill="${color}" stroke="white" stroke-width="3"/>`;
        } else if (shape === 'square') {
            svg += `<rect x="10" y="10" width="80" height="80" rx="10" fill="${color}" stroke="white" stroke-width="3"/>`;
        } else if (shape === 'triangle') {
            svg += `<polygon points="50,10 90,90 10,90" fill="${color}" stroke="white" stroke-width="3"/>`;
        }
        
        svg += '</svg>';
        return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    cutSprite(img, col, row, w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, col * w, row * h, w, h, 0, 0, w, h);
        return canvas.toDataURL();
    }

    setupEventListeners() {
        // Leave game
        document.getElementById('leave').addEventListener('click', () => {
            if (confirm('Leave training mode?')) {
                window.location.href = '/';
            }
        });

        // Reset scores
        document.getElementById('resetScores').addEventListener('click', () => {
            if (confirm('Reset scores?')) {
                this.resetGame();
            }
        });

        // Move buttons
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.gameState.isPlaying) return;
                
                const move = e.currentTarget.dataset.move;
                
                // Visual feedback
                document.querySelectorAll('.move-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
                
                this.makeMove(move);
            });
        });
    }

    startGame() {
        // Enable controls
        this.enableControls();
        
        // Start timer
        this.startTimer();
        
        // Show initial banner
        this.showBanner('Choose your move!', 'info');
    }

    enableControls() {
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.disabled = false;
        });
        this.gameState.isPlaying = false;
    }

    disableControls() {
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.remove('selected');
        });
    }

    startTimer() {
        // Clear any existing timer
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        
        // Reset timer
        this.gameState.timer = 10;
        this.updateTimerDisplay();
        
        // Start countdown
        this.gameState.timerInterval = setInterval(() => {
            this.gameState.timer--;
            this.updateTimerDisplay();
            
            // Auto-play when timer reaches 0
            if (this.gameState.timer <= 0) {
                clearInterval(this.gameState.timerInterval);
                if (!this.gameState.isPlaying) {
                    this.autoPlay();
                }
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerEl = document.getElementById('timer');
        const timeText = `${this.gameState.timer} second${this.gameState.timer !== 1 ? 's' : ''}`;
        
        document.getElementById('timerText').textContent = timeText;
        
        // Warning color for last 5 seconds
        if (this.gameState.timer <= 5) {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }
    }

    autoPlay() {
        if (this.gameState.isPlaying) return;
        
        // Randomly select a move
        const moves = ['rock', 'paper', 'scissor'];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        
        console.log('Auto-playing:', randomMove);
        
        // Highlight the auto-selected move
        const autoBtn = document.querySelector(`[data-move="${randomMove}"]`);
        if (autoBtn) {
            autoBtn.classList.add('selected');
            setTimeout(() => {
                this.makeMove(randomMove);
            }, 300);
        }
    }

    makeMove(playerMove) {
        if (this.gameState.isPlaying) return;
        
        console.log('Player chose:', playerMove);
        
        // Set playing state
        this.gameState.isPlaying = true;
        this.disableControls();
        clearInterval(this.gameState.timerInterval);
        
        // Show player's move immediately
        document.getElementById('p1Img').src = this.sprites[this.mySkin][playerMove];
        this.showBanner('Computer is thinking...', 'info');
        
        // CPU "thinking" delay
        setTimeout(() => {
            this.cpuMove(playerMove);
        }, this.cpu.thinkingTime);
    }

    cpuMove(playerMove) {
        // CPU chooses random move
        const moves = ['rock', 'paper', 'scissor'];
        const cpuMove = moves[Math.floor(Math.random() * moves.length)];
        
        console.log('CPU chose:', cpuMove);
        
        // Show CPU move
        document.getElementById('p2Img').src = this.sprites[this.cpu.skin][cpuMove];
        
        // Show what CPU picked in the banner
        this.showBanner(`Computer picked ${cpuMove.toUpperCase()}!`, 'info');
        
        // Short delay before evaluating
        setTimeout(() => {
            this.evaluateRound(playerMove, cpuMove);
        }, 800);
    }

    evaluateRound(playerMove, cpuMove) {
        let winner = 'draw';
        let resultText = '';
        
        console.log('Evaluating:', playerMove, 'vs', cpuMove);
        
        if (playerMove === cpuMove) {
            winner = 'draw';
            resultText = "It's a draw!";
        } else if (
            (playerMove === 'rock' && cpuMove === 'scissor') ||
            (playerMove === 'paper' && cpuMove === 'rock') ||
            (playerMove === 'scissor' && cpuMove === 'paper')
        ) {
            winner = 'player';
            this.gameState.playerScore++;
            resultText = `You win! ${playerMove.toUpperCase()} beats ${cpuMove.toUpperCase()}`;
        } else {
            winner = 'cpu';
            this.gameState.cpuScore++;
            resultText = `Computer wins! ${cpuMove.toUpperCase()} beats ${playerMove.toUpperCase()}`;
        }
        
        // Update scores on screen
        document.getElementById('p1Score').textContent = this.gameState.playerScore;
        document.getElementById('p2Score').textContent = this.gameState.cpuScore;
        
        // Update round
        this.gameState.round++;
        document.getElementById('roundNumber').textContent = this.gameState.round;
        
        console.log('Result:', winner, 'Scores:', this.gameState.playerScore, '-', this.gameState.cpuScore);
        
        // Show result with effects
        this.showResult(winner, resultText);
    }

    showResult(winner, resultText) {
        // Show banner
        this.showBanner(resultText, winner === 'draw' ? 'draw' : (winner === 'player' ? 'win' : 'lose'));
        
        // Apply effects
        if (winner === 'draw') {
            this.showDraw();
        } else if (winner === 'player') {
            this.showConfetti();
        } else {
            this.showFire();
        }
        
        // Check for match winner
        this.checkMatchWinner();
    }

    checkMatchWinner() {
        if (this.gameState.playerScore >= this.FIRST_TO || this.gameState.cpuScore >= this.FIRST_TO) {
            const winnerName = this.gameState.playerScore >= this.FIRST_TO ? this.myName : this.cpu.name;
            
            setTimeout(() => {
                this.showBanner(`${winnerName} wins the match!`, 'victory');
                
                setTimeout(() => {
                    if (confirm(`${winnerName} wins! Start a new match?`)) {
                        this.resetGame();
                    }
                }, 2000);
            }, 1500);
        } else {
            // Prepare for next round
            setTimeout(() => {
                this.prepareNextRound();
            }, 2000);
        }
    }

    prepareNextRound() {
        // Reset hand images to default
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        document.getElementById('p2Img').src = this.sprites[this.cpu.skin].rock;
        
        // Enable controls
        this.enableControls();
        
        // Start new timer
        this.startTimer();
        
        // Update game state
        this.gameState.isPlaying = false;
        
        // Show banner
        this.showBanner('Choose your move!', 'info');
    }

    resetGame() {
        console.log('Resetting game');
        
        // Reset scores
        this.gameState.playerScore = 0;
        this.gameState.cpuScore = 0;
        this.gameState.round = 1;
        
        // Update UI
        document.getElementById('p1Score').textContent = '0';
        document.getElementById('p2Score').textContent = '0';
        document.getElementById('roundNumber').textContent = '1';
        
        // Reset hand images
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        document.getElementById('p2Img').src = this.sprites[this.cpu.skin].rock;
        
        // Clear any existing timer
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        
        // Reset game
        this.startGame();
    }

    showBanner(text, type) {
        const banner = document.getElementById('resultBanner');
        banner.textContent = text;
        banner.className = 'result-banner';
        
        // Apply styles based on type
        switch (type) {
            case 'win':
                banner.style.color = '#4caf50';
                banner.style.background = 'rgba(76, 175, 80, 0.1)';
                break;
            case 'lose':
                banner.style.color = '#f44336';
                banner.style.background = 'rgba(244, 67, 54, 0.1)';
                break;
            case 'draw':
                banner.style.color = '#ff9800';
                banner.style.background = 'rgba(255, 152, 0, 0.1)';
                break;
            case 'victory':
                banner.style.color = '#9c27b0';
                banner.style.background = 'rgba(156, 39, 176, 0.1)';
                banner.style.animation = 'pulse 0.5s infinite';
                break;
            case 'info':
                banner.style.color = '#2196f3';
                banner.style.background = 'rgba(33, 150, 243, 0.1)';
                break;
            default:
                banner.style.color = '';
                banner.style.background = '';
                banner.style.animation = '';
        }
    }

    showConfetti() {
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 200;
        
        // Clear any existing animation
        if (this.confettiAnimationId) {
            cancelAnimationFrame(this.confettiAnimationId);
        }
        
        // Create confetti particles
        const particles = [];
        const colors = ['#ff3b3b', '#ffd23d', '#3be3ff', '#7effa1', '#ff6bff'];
        
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * 50 - 100, // Start above canvas
                size: Math.random() * 8 + 4,
                speedX: (Math.random() - 0.5) * 6,
                speedY: Math.random() * 5 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: Math.random() > 0.5 ? 'circle' : 'rect',
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }
        
        let startTime = Date.now();
        const duration = 3000; // 3 seconds
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeParticles = 0;
            
            particles.forEach(p => {
                // Update position
                p.x += p.speedX;
                p.y += p.speedY;
                p.speedY += 0.1; // Gravity
                p.rotation += p.rotationSpeed;
                
                // Draw particle
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                
                ctx.fillStyle = p.color;
                
                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                }
                
                ctx.restore();
                
                // Count if particle is still on screen
                if (p.y < canvas.height && elapsed < duration) {
                    activeParticles++;
                }
            });
            
            // Continue animation if there are active particles and time hasn't expired
            if (activeParticles > 0 && elapsed < duration) {
                this.confettiAnimationId = requestAnimationFrame(animate);
            } else {
                // Clean up
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                this.confettiAnimationId = null;
            }
        };
        
        // Start animation
        animate();
    }

    showFire() {
        const fire = document.getElementById('fireEffect');
        if (!fire) return;
        
        fire.classList.add('active');
        
        // Create fire particles
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 200;
        
        // Clear any existing animation
        if (this.fireAnimationId) {
            cancelAnimationFrame(this.fireAnimationId);
        }
        
        const particles = [];
        
        for (let i = 0; i < 30; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 80,
                y: canvas.height + Math.random() * 20,
                size: Math.random() * 12 + 8,
                speedX: (Math.random() - 0.5) * 4,
                speedY: -(Math.random() * 5 + 3),
                color: `hsl(${Math.random() * 20 + 10}, 100%, ${50 + Math.random() * 20}%)`,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.01
            });
        }
        
        const animateFire = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeParticles = 0;
            
            particles.forEach(p => {
                // Update position and life
                p.x += p.speedX;
                p.y += p.speedY;
                p.speedX *= 0.98; // Slow down horizontally
                p.life -= p.decay;
                
                // Draw particle with opacity based on life
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Count if particle is still alive
                if (p.life > 0 && p.y > 0) {
                    activeParticles++;
                }
            });
            
            if (activeParticles > 0) {
                this.fireAnimationId = requestAnimationFrame(animateFire);
            } else {
                this.fireAnimationId = null;
            }
        };
        
        animateFire();
        
        // Remove fire effect after delay
        setTimeout(() => {
            fire.classList.remove('active');
            if (this.fireAnimationId) {
                cancelAnimationFrame(this.fireAnimationId);
                this.fireAnimationId = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 2000);
    }

    showDraw() {
        // Simple shake animation for draw
        const hands = [document.getElementById('p1Img'), document.getElementById('p2Img')];
        hands.forEach(hand => {
            if (hand) {
                hand.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    hand.style.animation = '';
                }, 500);
            }
        });
    }
}

// Start the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CPUGame();
});