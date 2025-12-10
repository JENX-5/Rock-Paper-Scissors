class PvPGame {
    constructor() {
        // Get URL parameters
        this.params = new URLSearchParams(location.search);
        this.roomId = this.params.get('room');
        this.myName = decodeURIComponent(this.params.get('name') || 'Player');
        this.mySkin = Number(this.params.get('skin') || 0);
        
        // Game state
        this.sprites = null;
        this.gameState = {
            round: 1,
            timer: 10,
            timerInterval: null,
            isPlaying: false,
            myChoice: null,
            opponentChoice: null,
            scores: { p1: 0, p2: 0 }
        };
        
        // Socket.io connection
        this.socket = io();
        this.myRole = null;
        this.opponent = null;
        this.unreadMessages = 0;
        
        this.FIRST_TO = 5;
        
        // Initialize
        this.init();
    }

    async init() {
        console.log('Starting PvP game in room:', this.roomId);
        
        // Apply skin theme
        document.body.className = 'skin' + this.mySkin;
        
        // Update UI
        document.getElementById('roomLabel').textContent = `Room: ${this.roomId || 'Creating...'}`;
        document.body.classList.add('pvp-mode');
        
        // Set initial player info
        document.getElementById('p1Name').textContent = 'Player 1';
        document.getElementById('p2Name').textContent = 'Player 2';
        
        // Load sprites
        await this.loadSprites();
        
        // Set initial hand images
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        document.getElementById('p2Img').src = this.sprites[(this.mySkin + 1) % 4].rock;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup socket connection
        this.setupSocket();
        
        // Join room
        this.joinRoom();
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
                    skin.rock = this.cutSprite(img, col, 3, cw, ch);
                    skin.paper = this.cutSprite(img, col, 2, cw, ch);
                    skin.scissor = this.cutSprite(img, col, 1, cw, ch);
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
            if (confirm('Leave the game?')) {
                window.location.href = '/';
            }
        });

        // Reset scores
        document.getElementById('resetScores').addEventListener('click', () => {
            if (confirm('Reset scores?')) {
                this.socket.emit('reset', { room: this.roomId });
            }
        });

        // Move buttons
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.gameState.isPlaying || !this.myRole) return;
                
                const move = e.currentTarget.dataset.move;
                
                // Visual feedback
                document.querySelectorAll('.move-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
                
                this.makeMove(move);
            });
        });

        // Chat toggle button
        document.getElementById('chatToggle').addEventListener('click', () => {
            this.toggleChat();
        });

        // Close chat button (in chat panel)
        document.getElementById('closeChat').addEventListener('click', () => {
            this.closeChat();
        });

        // Chat send
        document.getElementById('chatSend').addEventListener('click', () => {
            this.sendChatMessage();
        });

        // Chat input enter key
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
    }

    toggleChat() {
        const chatPanel = document.querySelector('.chat-panel');
        const isOpen = chatPanel.classList.contains('open');
        
        if (isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const chatPanel = document.querySelector('.chat-panel');
        chatPanel.classList.add('open');
        
        // Reset unread count
        this.unreadMessages = 0;
        this.updateChatBadge();
        
        // Focus input
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 300);
    }

    closeChat() {
        const chatPanel = document.querySelector('.chat-panel');
        chatPanel.classList.remove('open');
    }

    updateChatBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (this.unreadMessages > 0) {
                badge.textContent = this.unreadMessages;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    setupSocket() {
        // Socket event handlers
        this.socket.on('joined', (data) => {
            console.log('Joined room as:', data.role);
            this.myRole = data.role;
            this.roomId = data.room;
            
            // Update room display
            document.getElementById('roomLabel').textContent = `Room: ${this.roomId}`;
            
            // Update opponent info if available
            if (data.opponent) {
                this.updateOpponent(data.opponent);
            }
            
            // Enable controls if we're the second player
            if (data.role === 'p2') {
                this.enableControls();
                this.showBanner('Game started! Choose your move!', 'info');
                this.startTimer();
            } else {
                this.showBanner('Waiting for opponent to join...', 'info');
            }
        });

        this.socket.on('players', (data) => {
            console.log('Players updated:', data);
            this.updatePlayers(data);
            this.gameState.scores = data.scores;
        });

        this.socket.on('choiceMade', (data) => {
            console.log('Opponent made choice:', data);
            
            if (data.player !== this.myRole) {
                this.gameState.opponentChoice = data.choice;
                this.showBanner('Opponent has chosen!', 'info');
                
                // Show opponent's choice
                const opponentPanel = this.myRole === 'p1' ? 'p2' : 'p1';
                const opponentSkin = opponentPanel === 'p1' ? 
                    (data.player === 'p1' ? this.mySkin : (this.opponent?.skin || 0)) : 
                    (data.player === 'p2' ? this.mySkin : (this.opponent?.skin || 0));
                
                if (this.sprites[opponentSkin]) {
                    document.getElementById(`${opponentPanel}Img`).src = 
                        this.sprites[opponentSkin][data.choice];
                }
                
                // Update indicator
                document.getElementById(`${opponentPanel}Indicator`).className = 'player-indicator thinking';
            }
        });

        this.socket.on('result', (data) => {
            console.log('Round result:', data);
            this.showRoundResult(data);
        });

        this.socket.on('matchWinner', (data) => {
            console.log('Match winner:', data);
            this.showMatchWinner(data);
        });

        this.socket.on('chat', (data) => {
            // Add message
            this.addChatMessage(data.sender, data.message, data.timestamp);
            
            // Increment unread if chat is closed
            const chatPanel = document.querySelector('.chat-panel');
            if (!chatPanel.classList.contains('open')) {
                this.unreadMessages++;
                this.updateChatBadge();
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showBanner(error, 'lose');
        });
    }

    joinRoom() {
        this.socket.emit('joinRoom', {
            room: this.roomId,
            name: this.myName,
            skin: this.mySkin,
            mode: 'pvp'
        });
    }

    updatePlayers(data) {
        // Update player 1 info
        if (data.p1) {
            document.getElementById('p1Name').textContent = data.p1.name;
            document.getElementById('p1Status').textContent = data.p1.id === this.socket.id ? 'You' : 'Opponent';
            document.getElementById('p1Score').textContent = data.scores.p1;
            
            if (data.p1.id !== this.socket.id) {
                this.opponent = data.p1;
                document.getElementById('p1Img').src = this.sprites[data.p1.skin].rock;
            }
        } else {
            document.getElementById('p1Name').textContent = 'Waiting...';
            document.getElementById('p1Status').textContent = 'Not connected';
            document.getElementById('p1Indicator').className = 'player-indicator';
        }

        // Update player 2 info
        if (data.p2) {
            document.getElementById('p2Name').textContent = data.p2.name;
            document.getElementById('p2Status').textContent = data.p2.id === this.socket.id ? 'You' : 'Opponent';
            document.getElementById('p2Score').textContent = data.scores.p2;
            
            if (data.p2.id !== this.socket.id) {
                this.opponent = data.p2;
                document.getElementById('p2Img').src = this.sprites[data.p2.skin].rock;
            }
        } else {
            document.getElementById('p2Name').textContent = 'Waiting...';
            document.getElementById('p2Status').textContent = 'Not connected';
            document.getElementById('p2Indicator').className = 'player-indicator';
        }

        // Update round
        document.getElementById('roundNumber').textContent = data.round;

        // Update indicators
        if (data.p1 && data.p1.id === this.socket.id) {
            document.getElementById('p1Indicator').className = 'player-indicator active';
        }
        if (data.p2 && data.p2.id === this.socket.id) {
            document.getElementById('p2Indicator').className = 'player-indicator active';
        }

        // Check if game can start
        if (data.p1 && data.p2 && !this.gameState.isPlaying) {
            this.enableControls();
            this.showBanner('Game started! Choose your move!', 'info');
            this.startTimer();
        }
    }

    updateOpponent(opponent) {
        this.opponent = opponent;
        if (opponent) {
            const opponentPanel = this.myRole === 'p1' ? 'p2' : 'p1';
            document.getElementById(`${opponentPanel}Name`).textContent = opponent.name;
            document.getElementById(`${opponentPanel}Status`).textContent = 'Opponent';
            document.getElementById(`${opponentPanel}Img`).src = this.sprites[opponent.skin].rock;
        }
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
                if (!this.gameState.isPlaying && this.myRole) {
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
        if (this.gameState.isPlaying || !this.myRole) return;
        
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

    makeMove(move) {
        if (this.gameState.isPlaying || !this.myRole) return;
        
        console.log('Making move:', move);
        
        // Set playing state
        this.gameState.isPlaying = true;
        this.gameState.myChoice = move;
        this.disableControls();
        clearInterval(this.gameState.timerInterval);
        
        // Show my move
        const myPanel = this.myRole === 'p1' ? 'p1' : 'p2';
        document.getElementById(`${myPanel}Img`).src = this.sprites[this.mySkin][move];
        
        // Show opponent is thinking
        this.showBanner('Waiting for opponent...', 'info');
        
        // Send move to server
        this.socket.emit('play', {
            room: this.roomId,
            role: this.myRole,
            choice: move
        });
    }

    showRoundResult(data) {
        console.log('Showing round result:', data);
        
        // Clear playing state
        this.gameState.isPlaying = false;
        this.gameState.myChoice = null;
        this.gameState.opponentChoice = null;
        
        // Update scores in game state
        this.gameState.scores = data.scores;
        
        // Update scores display
        document.getElementById('p1Score').textContent = data.scores.p1;
        document.getElementById('p2Score').textContent = data.scores.p2;
        
        // Update round
        document.getElementById('roundNumber').textContent = data.round;
        this.gameState.round = data.round;
        
        // Show result
        let resultText = '';
        let resultType = 'draw';
        
        if (data.winner === 'draw') {
            resultText = "It's a draw!";
            resultType = 'draw';
            this.showDraw();
        } else {
            const winnerName = data.players[data.winner].name;
            const winnerMove = data[data.winner];
            const loserMove = data[data.winner === 'p1' ? 'p2' : 'p1'];
            
            resultText = `${winnerName} wins! ${winnerMove.toUpperCase()} beats ${loserMove.toUpperCase()}`;
            
            // Check if I won
            const iWon = data.winner === this.myRole;
            resultType = iWon ? 'win' : 'lose';
            
            // Add "You" prefix if it's me
            if (data.players[data.winner].id === this.socket.id) {
                resultText = `You win! ${winnerMove.toUpperCase()} beats ${loserMove.toUpperCase()}`;
            } else if (data.players[data.winner === 'p1' ? 'p2' : 'p1'].id === this.socket.id) {
                resultText = `You lose! ${winnerMove.toUpperCase()} beats ${loserMove.toUpperCase()}`;
            }
            
            if (iWon) {
                this.showConfetti();
            } else {
                this.showFire();
            }
        }
        
        this.showBanner(resultText, resultType);
        
        // Reset for next round after delay
        setTimeout(() => {
            if (data.scores.p1 < this.FIRST_TO && data.scores.p2 < this.FIRST_TO) {
                this.prepareNextRound();
            }
        }, 2000);
    }

    prepareNextRound() {
        // Reset hand images to default
        const p1Skin = this.myRole === 'p1' ? this.mySkin : (this.opponent?.skin || 0);
        const p2Skin = this.myRole === 'p2' ? this.mySkin : (this.opponent?.skin || 0);
        
        document.getElementById('p1Img').src = this.sprites[p1Skin].rock;
        document.getElementById('p2Img').src = this.sprites[p2Skin].rock;
        
        // Reset indicators
        document.getElementById('p1Indicator').className = 'player-indicator';
        document.getElementById('p2Indicator').className = 'player-indicator';
        
        // Enable controls
        this.enableControls();
        
        // Start new timer
        this.startTimer();
        
        // Show banner
        this.showBanner('Choose your move!', 'info');
    }

    showMatchWinner(data) {
        const winnerName = data.winnerName;
        const isWinner = data.winner === this.myRole;
        
        const resultText = isWinner ? '🏆 You win the match! 🏆' : `${winnerName} wins the match!`;
        this.showBanner(resultText, 'victory');
        
        if (isWinner) {
            this.showConfetti();
        } else {
            this.showFire();
        }
        
        // Show match result overlay
        setTimeout(() => {
            this.showMatchResultOverlay(data);
        }, 2000);
    }

    showMatchResultOverlay(data) {
        const overlay = document.createElement('div');
        overlay.className = 'match-winner-overlay';
        overlay.innerHTML = `
            <div class="match-winner-content">
                <h2>🏆 Match Winner! 🏆</h2>
                <p><strong>${data.winnerName}</strong> wins the match!</p>
                <p>Final Score: ${data.scores.p1} - ${data.scores.p2}</p>
                <div style="margin-top: 30px;">
                    <button id="rematchBtn" class="control-btn reset" style="margin: 10px;">
                        <i class="fas fa-redo"></i> Rematch
                    </button>
                    <button id="newMatchBtn" class="control-btn leave" style="margin: 10px;">
                        <i class="fas fa-home"></i> Back to Lobby
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add event listeners to overlay buttons
        document.getElementById('rematchBtn').addEventListener('click', () => {
            this.socket.emit('reset', { room: this.roomId });
            overlay.remove();
            this.resetGame();
        });
        
        document.getElementById('newMatchBtn').addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    resetGame() {
        // Clear any existing timer
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        
        // Reset game state
        this.gameState = {
            round: 1,
            timer: 10,
            timerInterval: null,
            isPlaying: false,
            myChoice: null,
            opponentChoice: null,
            scores: { p1: 0, p2: 0 }
        };
        
        // Reset UI
        document.getElementById('p1Score').textContent = '0';
        document.getElementById('p2Score').textContent = '0';
        document.getElementById('roundNumber').textContent = '1';
        
        // Start new game
        this.enableControls();
        this.startTimer();
        this.showBanner('New match started! Choose your move!', 'info');
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

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.myRole) {
            // Send message to server
            this.socket.emit('chat', {
                room: this.roomId,
                sender: this.myName,
                message: message
            });
            
            // Clear input
            input.value = '';
        }
    }

    addChatMessage(sender, message, timestamp) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        // Determine message class
        let messageClass = 'message';
        if (sender === 'System') {
            messageClass = 'message system';
        } else if (sender === this.myName) {
            messageClass = 'message you';
        } else {
            messageClass = 'message opponent';
        }
        
        // Format timestamp
        const displayTime = timestamp || new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.className = messageClass;
        messageDiv.innerHTML = `
            <div class="message-sender">
                ${sender}
                <span class="timestamp">${displayTime}</span>
            </div>
            <div class="message-content">${message}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
    new PvPGame();
});