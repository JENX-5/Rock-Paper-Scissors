class PvPGame {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.roomId = this.params.get('room');
        this.playerName = decodeURIComponent(this.params.get('name') || 'Player');
        this.skin = parseInt(this.params.get('skin') || '0');
        
        this.socket = null;
        this.myRole = null;
        this.roomState = null;
        this.selectedMove = null;
        this.chatCollapsed = false;
        
        this.init();
    }
    
    init() {
        console.log('Starting PvP Game:', {
            room: this.roomId,
            name: this.playerName,
            skin: this.skin
        });
        
        // Update UI
        document.getElementById('gameTitle').textContent = 'Multiplayer Mode';
        document.getElementById('roomInfo').textContent = `Room: ${this.roomId}`;
        
        // Setup socket
        this.setupSocket();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize hand images
        this.initHandImages();
    }
    
    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            
            // Join room
            this.socket.emit('join-room', {
                roomId: this.roomId,
                name: this.playerName,
                skin: this.skin
            });
        });
        
        this.socket.on('joined', (data) => {
            console.log('Joined room:', data);
            this.myRole = data.role;
            this.updatePlayerInfo(data.players);
            
            // Enable chat
            document.getElementById('chatInput').disabled = false;
            document.getElementById('sendChatBtn').disabled = false;
        });
        
        this.socket.on('room-update', (state) => {
            this.roomState = state;
            this.updateGameState(state);
        });
        
        this.socket.on('choice-made', (data) => {
            console.log('Choice made:', data);
            this.showChoice(data.role, data.move);
        });
        
        this.socket.on('round-result', (result) => {
            console.log('Round result:', result);
            this.showRoundResult(result);
        });
        
        this.socket.on('game-winner', (data) => {
            this.showWinner(data);
        });
        
        this.socket.on('chat-message', (msg) => {
            this.addChatMessage(msg);
        });
        
        this.socket.on('error', (error) => {
            alert('Error: ' + error);
            window.location.href = '/';
        });
    }
    
    setupEventListeners() {
        // Leave button
        document.getElementById('leaveBtn').addEventListener('click', () => {
            if (confirm('Leave the game?')) {
                this.socket.emit('leave-room', { roomId: this.roomId });
                window.location.href = '/';
            }
        });
        
        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.socket.emit('reset-game', { roomId: this.roomId });
        });
        
        // Move buttons
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.myRole || !this.roomState) return;
                
                const move = e.currentTarget.dataset.move;
                this.selectedMove = move;
                
                // Visual feedback
                document.querySelectorAll('.hand-button').forEach(b => {
                    b.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
                
                // Send move
                this.socket.emit('make-move', {
                    roomId: this.roomId,
                    move: move,
                    role: this.myRole
                });
                
                // Disable buttons
                this.disableControls();
            });
        });
        
        // Chat
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChat());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
        
        // Chat toggle
        document.getElementById('chatToggle').addEventListener('click', () => {
            this.toggleChat();
        });
    }
    
    initHandImages() {
        const colors = ['blue', 'red', 'green', 'purple'];
        const color = colors[this.skin] || 'blue';
        
        // Create simple rock SVG
        const rockSVG = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${color}"/></svg>`;
        const svgData = 'data:image/svg+xml,' + encodeURIComponent(rockSVG);
        
        document.getElementById('p1Hand').src = svgData;
        document.getElementById('p2Hand').src = svgData;
    }
    
    updateHandImage(elementId, move) {
        const element = document.getElementById(elementId);
        const colors = ['blue', 'red', 'green', 'purple'];
        const color = colors[this.skin] || 'blue';
        
        let svg = '';
        if (move === 'rock') {
            svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${color}"/></svg>`;
        } else if (move === 'paper') {
            svg = `<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="15" fill="${color}"/></svg>`;
        } else if (move === 'scissor') {
            svg = `<svg viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="${color}"/></svg>`;
        }
        
        element.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    
    updatePlayerInfo(players) {
        // Update player 1
        if (players.p1) {
            document.getElementById('p1Name').textContent = players.p1.name;
            document.getElementById('p1Status').textContent = players.p1.role === this.myRole ? 'You' : 'Opponent';
        }
        
        // Update player 2
        if (players.p2) {
            document.getElementById('p2Name').textContent = players.p2.name;
            document.getElementById('p2Status').textContent = players.p2.role === this.myRole ? 'You' : 'Opponent';
        }
    }
    
    updateGameState(state) {
        // Update scores
        document.getElementById('p1Score').textContent = state.scores.p1;
        document.getElementById('p2Score').textContent = state.scores.p2;
        
        // Update round
        document.getElementById('roundNumber').textContent = state.round;
        
        // Reset hand images if round ended
        if (!state.choices?.p1) {
            this.updateHandImage('p1Hand', 'rock');
        }
        if (!state.choices?.p2) {
            this.updateHandImage('p2Hand', 'rock');
        }
        
        // Enable/disable controls
        if (state.choices?.[this.myRole]) {
            this.disableControls();
            this.showBanner('Waiting for opponent...');
        } else {
            this.enableControls();
            this.showBanner('Choose your move!');
        }
    }
    
    showChoice(role, move) {
        const elementId = role === 'p1' ? 'p1Hand' : 'p2Hand';
        this.updateHandImage(elementId, move);
        
        if (role !== this.myRole) {
            this.showBanner('Opponent chose!');
        }
    }
    
    showRoundResult(result) {
        this.showBanner(result.message);
        
        // Reset after delay
        setTimeout(() => {
            this.enableControls();
            this.selectedMove = null;
            document.querySelectorAll('.hand-button').forEach(b => {
                b.classList.remove('selected');
            });
        }, 2000);
    }
    
    showWinner(data) {
        this.showBanner(`${data.winnerName} wins the match! 🎉`);
        
        setTimeout(() => {
            if (confirm(`${data.winnerName} wins! Reset game?`)) {
                this.socket.emit('reset-game', { roomId: this.roomId });
            }
        }, 2000);
    }
    
    enableControls() {
        if (!this.myRole) return;
        
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.disabled = false;
        });
    }
    
    disableControls() {
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.disabled = true;
        });
    }
    
    showBanner(text) {
        document.getElementById('resultBanner').textContent = text;
    }
    
    sendChat() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.socket) {
            this.socket.emit('send-chat', {
                roomId: this.roomId,
                message: message,
                userName: this.playerName
            });
            input.value = '';
        }
    }
    
    addChatMessage(msg) {
        const chatMessages = document.getElementById('chatMessages');
        
        // Remove placeholder
        if (chatMessages.querySelector('.text-center')) {
            chatMessages.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${msg.user === 'System' ? 'system' : 'user'}`;
        
        messageDiv.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-sm ${msg.user === 'System' ? 'text-blue-300' : 'text-purple-300'}">
                    ${msg.user}
                </span>
                <span class="text-xs text-white/50">${msg.time}</span>
            </div>
            <div class="text-white/90">${msg.message}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Show new message indicator if chat is collapsed
        if (this.chatCollapsed) {
            document.getElementById('newMessageIndicator').classList.remove('hidden');
        }
    }
    
    toggleChat() {
        const chatContainer = document.getElementById('chatContainer');
        const chatInputArea = document.getElementById('chatInputArea');
        const toggleIcon = document.getElementById('chatToggleIcon');
        
        this.chatCollapsed = !this.chatCollapsed;
        
        if (this.chatCollapsed) {
            chatContainer.classList.add('hidden');
            chatInputArea.classList.add('hidden');
            toggleIcon.className = 'fas fa-chevron-up';
        } else {
            chatContainer.classList.remove('hidden');
            chatInputArea.classList.remove('hidden');
            toggleIcon.className = 'fas fa-chevron-down';
            document.getElementById('newMessageIndicator').classList.add('hidden');
        }
    }
}

// Start PvP game
document.addEventListener('DOMContentLoaded', () => {
    new PvPGame();
});