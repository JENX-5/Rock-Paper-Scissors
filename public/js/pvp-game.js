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
            scores: { myScore: 0, opponentScore: 0 }
        };
        
        // Socket.io connection
        this.socket = io();
        this.myRole = null;
        this.opponent = null;
        this.unreadMessages = 0;
        
        this.FIRST_TO = 5;
        this.isMatchEnded = false;
        
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
        document.getElementById('p1Name').textContent = this.myName;
        document.getElementById('p1Status').textContent = 'You';
        document.getElementById('p2Name').textContent = 'Opponent';
        document.getElementById('p2Status').textContent = 'Waiting...';
        
        // Load sprites
        await this.loadSprites();
        
        // Set initial hand images
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        document.getElementById('p2Img').src = await this.horizontallyFlipImage(this.sprites[(this.mySkin + 1) % 4].rock);
        
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
                    skin.rock = this.cutSprite(img, col, 3, cw, ch, 'rock');
                    skin.paper = this.cutSprite(img, col, 2, cw, ch, 'paper');
                    skin.scissor = this.cutSprite(img, col, 1, cw, ch, 'scissor');
                    this.sprites.push(skin);
                }
                console.log('Sprites loaded successfully');
                resolve();
            };
            
            img.onerror = () => {
                console.log('Using fallback sprites');
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

    cutSprite(img, col, row, w, h, type) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const cropMargin = 5;
        const srcX = col * w + cropMargin;
        const srcY = row * h + cropMargin;
        const srcWidth = w - (cropMargin * 2);
        const srcHeight = h - (cropMargin * 2);
        
        canvas.width = srcWidth;
        canvas.height = srcHeight;
        
        if (type === 'scissor') {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 
                        -srcWidth / 2, -srcHeight / 2, srcWidth, srcHeight);
            
        } else if (type === 'paper') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 
                        0, 0, srcWidth, srcHeight);
            
        } else {
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 
                        0, 0, srcWidth, srcHeight);
        }
        
        return canvas.toDataURL();
    }

    horizontallyFlipImage(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                
                resolve(canvas.toDataURL());
            };
            
            img.onerror = () => {
                resolve(imageUrl);
            };
            
            img.src = imageUrl;
        });
    }

    setupEventListeners() {
        document.getElementById('leave').addEventListener('click', () => {
            if (confirm('Leave the game?')) {
                window.location.href = '/';
            }
        });

        document.getElementById('resetScores').addEventListener('click', () => {
            if (confirm('Reset scores?')) {
                this.socket.emit('reset', { room: this.roomId });
            }
        });

        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.gameState.isPlaying || !this.myRole || this.isMatchEnded) return;
                
                const move = e.currentTarget.dataset.move;
                
                document.querySelectorAll('.move-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
                
                this.makeMove(move);
            });
        });

        document.getElementById('chatToggle').addEventListener('click', () => {
            this.toggleChat();
        });

        document.getElementById('closeChat').addEventListener('click', () => {
            this.closeChat();
        });

        document.getElementById('chatSend').addEventListener('click', () => {
            this.sendChatMessage();
        });

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
        
        this.unreadMessages = 0;
        this.updateChatBadge();
        
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
                badge.textContent = Math.min(this.unreadMessages, 99);
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    setupSocket() {
        this.socket.on('joined', (data) => {
            console.log('Joined room as:', data.role);
            this.myRole = data.role;
            this.roomId = data.room;
            this.isMatchEnded = false;
            
            document.getElementById('roomLabel').textContent = `Room: ${this.roomId}`;
            
            if (data.opponent) {
                this.updateOpponent(data.opponent);
            }
            
            if (data.role === 'p2') {
                this.enableControls();
                this.showBanner('Game started! Choose your move!', 'info');
                this.startTimer();
            } else {
                this.showBanner('Waiting for opponent to join...', 'info');
            }
        });

        this.socket.on('players', async (data) => {
            console.log('Players updated:', data);
            await this.updatePlayers(data);
            // Store server scores for reference
            this.serverScores = data.scores;
        });

        this.socket.on('choiceMade', async (data) => {
            console.log('Opponent made choice:', data);
            
            if (data.player !== this.myRole) {
                this.gameState.opponentChoice = data.choice;
                
                const opponentSkin = this.opponent?.skin || 0;
                
                if (this.sprites[opponentSkin]) {
                    const opponentSprite = this.sprites[opponentSkin][data.choice];
                    const flippedSprite = await this.horizontallyFlipImage(opponentSprite);
                    document.getElementById('p2Img').src = flippedSprite;
                }
                
                document.getElementById('p2Indicator').className = 'player-indicator thinking';
            }
        });

        this.socket.on('result', (data) => {
            console.log('Round result:', data);
            this.showRoundResult(data);
        });

        this.socket.on('matchWinner', (data) => {
            console.log('Match winner:', data);
            this.isMatchEnded = true;
            
            if (this.gameState.timerInterval) {
                clearInterval(this.gameState.timerInterval);
                this.gameState.timerInterval = null;
            }
            
            this.disableControls();
            
            // FIX: Correctly display who won
            const isWinner = data.winner === this.myRole;
            const winnerName = isWinner ? this.myName : (this.opponent?.name || 'Opponent');
            const resultText = isWinner ? '🏆 You win the match! 🏆' : `${winnerName} wins the match!`;
            
            this.showBanner(resultText, 'victory');
            
            if (isWinner) {
                this.showConfetti();
            } else {
                this.showFire();
            }
            
            // Show match result overlay with correct scores
            setTimeout(() => {
                this.showMatchResultOverlay(data, winnerName);
            }, 2000);
        });

        this.socket.on('chat', (data) => {
            this.addChatMessage(data.sender, data.message, data.timestamp);
            
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

    async updatePlayers(data) {
        // FIXED: Always show my info on left, opponent on right regardless of server role
        if (data.p1 && data.p1.id === this.socket.id) {
            // I am Player 1
            this.opponent = data.p2;
            
            // Left panel (me)
            document.getElementById('p1Name').textContent = data.p1.name;
            document.getElementById('p1Status').textContent = 'You';
            document.getElementById('p1Score').textContent = data.scores.p1;
            
            // Right panel (opponent or waiting)
            if (data.p2) {
                document.getElementById('p2Name').textContent = data.p2.name;
                document.getElementById('p2Status').textContent = 'Opponent';
                document.getElementById('p2Score').textContent = data.scores.p2;
                const flippedRock = await this.horizontallyFlipImage(this.sprites[data.p2.skin].rock);
                document.getElementById('p2Img').src = flippedRock;
            } else {
                document.getElementById('p2Name').textContent = 'Waiting...';
                document.getElementById('p2Status').textContent = 'Not connected';
                document.getElementById('p2Score').textContent = '0';
            }
            
        } else if (data.p2 && data.p2.id === this.socket.id) {
            // I am Player 2
            this.opponent = data.p1;
            
            // Left panel (me)
            document.getElementById('p1Name').textContent = data.p2.name;
            document.getElementById('p1Status').textContent = 'You';
            document.getElementById('p1Score').textContent = data.scores.p2; // My score is p2 score
            
            // Right panel (opponent)
            if (data.p1) {
                document.getElementById('p2Name').textContent = data.p1.name;
                document.getElementById('p2Status').textContent = 'Opponent';
                document.getElementById('p2Score').textContent = data.scores.p1; // Opponent score is p1 score
                const flippedRock = await this.horizontallyFlipImage(this.sprites[data.p1.skin].rock);
                document.getElementById('p2Img').src = flippedRock;
            } else {
                document.getElementById('p2Name').textContent = 'Waiting...';
                document.getElementById('p2Status').textContent = 'Not connected';
                document.getElementById('p2Score').textContent = '0';
            }
        } else {
            // Spectator view (shouldn't happen)
            if (data.p1) {
                document.getElementById('p1Name').textContent = data.p1.name;
                document.getElementById('p1Status').textContent = 'Player 1';
                document.getElementById('p1Score').textContent = data.scores.p1;
            }
            if (data.p2) {
                document.getElementById('p2Name').textContent = data.p2.name;
                document.getElementById('p2Status').textContent = 'Player 2';
                document.getElementById('p2Score').textContent = data.scores.p2;
            }
        }

        document.getElementById('roundNumber').textContent = data.round;

        // Check if game can start
        if (data.p1 && data.p2 && !this.gameState.isPlaying && !this.isMatchEnded) {
            this.enableControls();
            this.startTimer();
        }
    }

    async updateOpponent(opponent) {
        this.opponent = opponent;
        if (opponent) {
            document.getElementById('p2Name').textContent = opponent.name;
            document.getElementById('p2Status').textContent = 'Opponent';
            const flippedRock = await this.horizontallyFlipImage(this.sprites[opponent.skin].rock);
            document.getElementById('p2Img').src = flippedRock;
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
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        
        this.gameState.timer = 10;
        this.updateTimerDisplay();
        
        this.gameState.timerInterval = setInterval(() => {
            this.gameState.timer--;
            this.updateTimerDisplay();
            
            if (this.gameState.timer <= 0) {
                clearInterval(this.gameState.timerInterval);
                if (!this.gameState.isPlaying && this.myRole && !this.isMatchEnded) {
                    this.autoPlay();
                }
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerEl = document.getElementById('timer');
        const timeText = `${this.gameState.timer} second${this.gameState.timer !== 1 ? 's' : ''}`;
        
        document.getElementById('timerText').textContent = timeText;
        
        if (this.gameState.timer <= 5) {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }
    }

    autoPlay() {
        if (this.gameState.isPlaying || !this.myRole || this.isMatchEnded) return;
        
        const moves = ['rock', 'paper', 'scissor'];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        
        console.log('Auto-playing:', randomMove);
        
        const autoBtn = document.querySelector(`[data-move="${randomMove}"]`);
        if (autoBtn) {
            autoBtn.classList.add('selected');
            setTimeout(() => {
                this.makeMove(randomMove);
            }, 300);
        }
    }

    async makeMove(move) {
        if (this.gameState.isPlaying || !this.myRole || this.isMatchEnded) return;
        
        console.log('Making move:', move);
        
        this.gameState.isPlaying = true;
        this.gameState.myChoice = move;
        this.disableControls();
        
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        
        document.getElementById('p1Img').src = this.sprites[this.mySkin][move];
        document.getElementById('p2Indicator').className = 'player-indicator thinking';
        
        this.showBanner('Waiting for opponent...', 'info');
        
        this.socket.emit('play', {
            room: this.roomId,
            role: this.myRole,
            choice: move
        });
    }

    async showRoundResult(data) {
        console.log('Showing round result:', data);
        
        this.gameState.isPlaying = false;
        this.gameState.myChoice = null;
        this.gameState.opponentChoice = null;
        
        // FIXED: Update scores based on which player I am
        if (data.players.p1 && data.players.p1.id === this.socket.id) {
            // I am Player 1
            document.getElementById('p1Score').textContent = data.scores.p1;
            document.getElementById('p2Score').textContent = data.scores.p2;
        } else if (data.players.p2 && data.players.p2.id === this.socket.id) {
            // I am Player 2
            document.getElementById('p1Score').textContent = data.scores.p2;
            document.getElementById('p2Score').textContent = data.scores.p1;
        }
        
        document.getElementById('roundNumber').textContent = data.round;
        this.gameState.round = data.round;
        
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
            
            // Check if I won
            const iWon = data.players[data.winner].id === this.socket.id;
            resultType = iWon ? 'win' : 'lose';
            
            if (iWon) {
                resultText = `You win! ${winnerMove.toUpperCase()} beats ${loserMove.toUpperCase()}`;
                this.showConfetti();
            } else {
                resultText = `You lose! ${winnerMove.toUpperCase()} beats ${loserMove.toUpperCase()}`;
                this.showFire();
            }
        }
        
        this.showBanner(resultText, resultType);
        
        // Reset for next round if match not ended
        if (data.scores.p1 < this.FIRST_TO && data.scores.p2 < this.FIRST_TO) {
            setTimeout(async () => {
                await this.prepareNextRound();
            }, 2000);
        }
    }

    async prepareNextRound() {
        if (this.isMatchEnded) return;
        
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        
        if (this.opponent) {
            const flippedRock = await this.horizontallyFlipImage(this.sprites[this.opponent.skin].rock);
            document.getElementById('p2Img').src = flippedRock;
        }
        
        document.getElementById('p1Indicator').className = 'player-indicator active';
        document.getElementById('p2Indicator').className = 'player-indicator';
        
        this.enableControls();
        this.startTimer();
    }

    showMatchResultOverlay(data, winnerName) {
        const overlay = document.createElement('div');
        overlay.className = 'match-winner-overlay';
        
        // Get current displayed scores
        const myScore = document.getElementById('p1Score').textContent;
        const opponentScore = document.getElementById('p2Score').textContent;
        
        overlay.innerHTML = `
            <div class="match-winner-content">
                <h2>🏆 Match Winner! 🏆</h2>
                <p><strong>${winnerName}</strong> wins the match!</p>
                <p>Final Score: ${myScore} - ${opponentScore}</p>
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
        
        document.getElementById('rematchBtn').addEventListener('click', () => {
            this.socket.emit('reset', { room: this.roomId });
            overlay.remove();
            this.resetGame();
        });
        
        document.getElementById('newMatchBtn').addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    async resetGame() {
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            this.gameState.timerInterval = null;
        }
        
        this.gameState = {
            round: 1,
            timer: 10,
            timerInterval: null,
            isPlaying: false,
            myChoice: null,
            opponentChoice: null,
            scores: { myScore: 0, opponentScore: 0 }
        };
        
        this.isMatchEnded = false;
        
        document.getElementById('p1Score').textContent = '0';
        document.getElementById('p2Score').textContent = '0';
        document.getElementById('roundNumber').textContent = '1';
        
        document.getElementById('p1Img').src = this.sprites[this.mySkin].rock;
        if (this.opponent) {
            const flippedRock = await this.horizontallyFlipImage(this.sprites[this.opponent.skin].rock);
            document.getElementById('p2Img').src = flippedRock;
        }
        
        this.enableControls();
        this.startTimer();
        this.showBanner('New match started! Choose your move!', 'info');
    }

    showBanner(text, type) {
        const banner = document.getElementById('resultBanner');
        banner.textContent = text;
        banner.className = 'result-banner';
        
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
            this.socket.emit('chat', {
                room: this.roomId,
                sender: this.myName,
                message: message
            });
            
            input.value = '';
        }
    }

    addChatMessage(sender, message, timestamp) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        let messageClass = 'message';
        if (sender === 'System') {
            messageClass = 'message system';
        } else if (sender === this.myName) {
            messageClass = 'message you';
        } else {
            messageClass = 'message opponent';
        }
        
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showConfetti() {
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 200;
        
        if (this.confettiAnimationId) {
            cancelAnimationFrame(this.confettiAnimationId);
        }
        
        const particles = [];
        const colors = ['#ff3b3b', '#ffd23d', '#3be3ff', '#7effa1', '#ff6bff'];
        
        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * 50 - 100,
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
        const duration = 3000;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeParticles = 0;
            
            particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.speedY += 0.1;
                p.rotation += p.rotationSpeed;
                
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
                
                if (p.y < canvas.height && elapsed < duration) {
                    activeParticles++;
                }
            });
            
            if (activeParticles > 0 && elapsed < duration) {
                this.confettiAnimationId = requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                this.confettiAnimationId = null;
            }
        };
        
        animate();
    }

    showFire() {
        const fire = document.getElementById('fireEffect');
        if (!fire) return;
        
        fire.classList.add('active');
        
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = canvas.offsetHeight || 200;
        
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
                p.x += p.speedX;
                p.y += p.speedY;
                p.speedX *= 0.98;
                p.life -= p.decay;
                
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
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