class Lobby {
    constructor() {
        this.skin = 0;
        this.init();
    }

    init() {
        this.loadSavedData();
        this.initSkinSelection();
        this.initEventListeners();
    }

    loadSavedData() {
        const savedName = localStorage.getItem('rps_username');
        const savedSkin = localStorage.getItem('rps_skin');
        
        if (savedName) {
            document.getElementById('name').value = savedName;
        }
        
        if (savedSkin) {
            this.skin = parseInt(savedSkin);
            document.body.className = 'skin' + this.skin;
            this.updateActiveSkin();
        }
    }

    initSkinSelection() {
        const skinCards = document.querySelectorAll('.skin-card');
        skinCards.forEach(card => {
            card.addEventListener('click', () => {
                this.skin = parseInt(card.dataset.skin);
                localStorage.setItem('rps_skin', this.skin);
                
                document.body.className = 'skin' + this.skin;
                this.updateActiveSkin();
            });
        });
        this.updateActiveSkin();
    }

    updateActiveSkin() {
        document.querySelectorAll('.skin-card').forEach(card => {
            card.classList.remove('active');
            if (parseInt(card.dataset.skin) === this.skin) {
                card.classList.add('active');
            }
        });
    }

    initEventListeners() {
        // Save username on input
        document.getElementById('name').addEventListener('input', (e) => {
            localStorage.setItem('rps_username', e.target.value);
        });

        // Play vs Computer - SIMPLIFIED
        document.getElementById('cpuBtn').addEventListener('click', () => {
            this.startCPUGame();
        });

        // Create Room
        document.getElementById('createBtn').addEventListener('click', () => {
            this.startGame('create');
        });

        // Join Room
        document.getElementById('joinBtn').addEventListener('click', () => {
            this.startGame('join');
        });

        // Enter key for room join
        document.getElementById('room').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startGame('join');
            }
        });
    }

    startCPUGame() {
        const nameInput = document.getElementById('name');
        let name = nameInput.value.trim();
        
        if (!name) {
            nameInput.focus();
            this.showNotification('Please enter your name!', 'error');
            return;
        }

        // Save name
        localStorage.setItem('rps_username', name);

        // CPU MODE - Simple URL with NO room parameter
        const url = `game.html?mode=cpu&name=${encodeURIComponent(name)}&skin=${this.skin}`;
        
        this.showNotification('Starting CPU game...', 'success');
        
        // Go immediately to game
        window.location.href = url;
    }

    startGame(mode) {
        const nameInput = document.getElementById('name');
        let name = nameInput.value.trim();
        
        if (!name) {
            nameInput.focus();
            this.showNotification('Please enter your name!', 'error');
            return;
        }

        // Save name
        localStorage.setItem('rps_username', name);

        let url = 'game.html?';
        url += `name=${encodeURIComponent(name)}`;
        url += `&skin=${this.skin}`;

        switch (mode) {
            case 'create':
                const roomId = Math.floor(1000 + Math.random() * 9000);
                url += `&mode=pvp&room=${roomId}`;
                this.showNotification(`Room created: ${roomId}`, 'success');
                break;
                
            case 'join':
                const roomInput = document.getElementById('room');
                const room = roomInput.value.trim();
                
                if (!room || !/^\d{4}$/.test(room)) {
                    roomInput.focus();
                    this.showNotification('Please enter a valid 4-digit room ID', 'error');
                    return;
                }
                url += `&mode=pvp&room=${room}`;
                break;
        }

        // Add a small delay for visual feedback
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }

    showNotification(message, type) {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize lobby when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Lobby();
});