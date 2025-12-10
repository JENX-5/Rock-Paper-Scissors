class CPUGame {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.playerName = decodeURIComponent(this.params.get('name') || 'Player');
        this.skin = parseInt(this.params.get('skin') || '0');
        
        this.gameState = {
            playerScore: 0,
            cpuScore: 0,
            round: 1,
            timer: 10,
            timerInterval: null,
            isPlaying: false,
            gameOver: false
        };
        
        this.cpuName = 'Computer 🤖';
        this.cpuSkin = (this.skin + 1) % 4;
        
        this.init();
    }
    
    init() {
        console.log('Starting CPU Game:', this.playerName);
        
        // Update UI
        document.getElementById('gameTitle').textContent = 'Training Mode';
        document.getElementById('roomInfo').textContent = 'Playing vs Computer';
        document.getElementById('p1Name').textContent = this.playerName;
        document.getElementById('p2Name').textContent = this.cpuName;
        document.getElementById('p1Status').textContent = 'You';
        document.getElementById('p2Status').textContent = 'Computer';
        
        // Set initial scores
        this.updateScores();
        this.updateRound();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start the game
        this.startRound();
    }
    
    setupEventListeners() {
        // Leave button
        document.getElementById('leaveBtn').addEventListener('click', () => {
            if (confirm('Leave training mode?')) {
                window.location.href = '/';
            }
        });
        
        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        // Move buttons
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.gameState.isPlaying || this.gameState.gameOver) return;
                
                const move = e.currentTarget.dataset.move;
                this.makeMove(move);
                
                // Visual feedback
                document.querySelectorAll('.hand-button').forEach(b => {
                    b.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
            });
        });
    }
    
    startRound() {
        this.gameState.isPlaying = false;
        this.updateRound();
        this.startTimer();
        this.enableControls();
        this.showBanner('Choose your move!');
        
        // Reset hand images
        this.updateHand('p1Hand', 'rock');
        this.updateHand('p2Hand', 'rock');
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
                if (!this.gameState.isPlaying) {
                    this.autoPlay();
                }
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timerEl = document.getElementById('timer');
        timerEl.textContent = this.gameState.timer;
        
        if (this.gameState.timer <= 5) {
            timerEl.classList.add('timer-warning');
        } else {
            timerEl.classList.remove('timer-warning');
        }
    }
    
    updateScores() {
        document.getElementById('p1Score').textContent = this.gameState.playerScore;
        document.getElementById('p2Score').textContent = this.gameState.cpuScore;
    }
    
    updateRound() {
        document.getElementById('roundNumber').textContent = this.gameState.round;
    }
    
    updateHand(elementId, move) {
        const element = document.getElementById(elementId);
        const colors = ['blue', 'red', 'green', 'purple'];
        const color = colors[this.skin] || 'blue';
        
        // Simple SVG generation
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
    
    enableControls() {
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.disabled = false;
        });
    }
    
    disableControls() {
        document.querySelectorAll('.hand-button').forEach(btn => {
            btn.disabled = true;
        });
    }
    
    autoPlay() {
        if (this.gameState.isPlaying || this.gameState.gameOver) return;
        
        const moves = ['rock', 'paper', 'scissor'];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        
        const autoBtn = document.querySelector(`[data-move="${randomMove}"]`);
        if (autoBtn) {
            autoBtn.classList.add('selected');
            setTimeout(() => {
                this.makeMove(randomMove);
            }, 300);
        }
    }
    
    makeMove(playerMove) {
        if (this.gameState.isPlaying || this.gameState.gameOver) return;
        
        this.gameState.isPlaying = true;
        this.disableControls();
        clearInterval(this.gameState.timerInterval);
        
        // Show player move
        this.updateHand('p1Hand', playerMove);
        this.showBanner('Computer is thinking...');
        
        // CPU move after delay
        setTimeout(() => {
            const cpuMove = this.getCPUMove();
            this.updateHand('p2Hand', cpuMove);
            
            setTimeout(() => {
                this.evaluateRound(playerMove, cpuMove);
            }, 500);
        }, 800);
    }
    
    getCPUMove() {
        const moves = ['rock', 'paper', 'scissor'];
        return moves[Math.floor(Math.random() * moves.length)];
    }
    
    evaluateRound(playerMove, cpuMove) {
        let winner = 'draw';
        let resultText = '';
        
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
            resultText = `You win! ${playerMove} beats ${cpuMove}`;
        } else {
            winner = 'cpu';
            this.gameState.cpuScore++;
            resultText = `Computer wins! ${cpuMove} beats ${playerMove}`;
        }
        
        // Update scores
        this.updateScores();
        
        // Show result
        this.showResult(winner, resultText);
        
        // Check for match winner
        this.checkMatchWinner();
    }
    
    showResult(winner, text) {
        this.showBanner(text);
        
        const resultBanner = document.getElementById('resultBanner');
        if (winner === 'player') {
            resultBanner.style.color = '#34d399'; // Green
        } else if (winner === 'cpu') {
            resultBanner.style.color = '#f87171'; // Red
        } else {
            resultBanner.style.color = '#fbbf24'; // Yellow
        }
    }
    
    showBanner(text) {
        document.getElementById('resultBanner').textContent = text;
    }
    
    checkMatchWinner() {
        if (this.gameState.playerScore >= 5 || this.gameState.cpuScore >= 5) {
            const winner = this.gameState.playerScore >= 5 ? this.playerName : this.cpuName;
            this.gameState.gameOver = true;
            
            setTimeout(() => {
                this.showBanner(`${winner} wins the match! 🎉`);
                this.disableControls();
                
                setTimeout(() => {
                    if (confirm(`${winner} wins! Play again?`)) {
                        this.resetGame();
                    }
                }, 2000);
            }, 1500);
        } else {
            setTimeout(() => {
                this.gameState.round++;
                this.startRound();
                document.querySelectorAll('.hand-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
            }, 2000);
        }
    }
    
    resetGame() {
        this.gameState.playerScore = 0;
        this.gameState.cpuScore = 0;
        this.gameState.round = 1;
        this.gameState.gameOver = false;
        
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        
        this.updateScores();
        this.startRound();
    }
}

// Start game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CPUGame();
});