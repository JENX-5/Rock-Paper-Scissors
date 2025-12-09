const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Socket.io Game Logic
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName, skin }) => {
        let room = rooms.get(roomId);
        
        if (!room) {
            room = {
                id: roomId,
                players: [],
                scores: { p1: 0, p2: 0 },
                choices: { p1: null, p2: null },
                round: 1
            };
            rooms.set(roomId, room);
        }
        
        if (room.players.length >= 2) {
            socket.emit('error', 'Room is full');
            return;
        }
        
        const player = {
            id: socket.id,
            name: playerName,
            skin,
            role: room.players.length === 0 ? 'p1' : 'p2'
        };
        
        room.players.push(player);
        socket.join(roomId);
        
        socket.emit('joined', {
            role: player.role,
            room: roomId,
            players: room.players
        });
        
        io.to(roomId).emit('playersUpdate', room.players);
        
        if (room.players.length === 2) {
            io.to(roomId).emit('gameStart', room);
        }
    });
    
    socket.on('makeMove', ({ roomId, move, role }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        
        room.choices[role] = move;
        
        if (room.choices.p1 && room.choices.p2) {
            const result = evaluateRound(room);
            io.to(roomId).emit('roundResult', result);
            
            // Reset choices for next round
            room.choices.p1 = null;
            room.choices.p2 = null;
            room.round++;
            
            // Check for winner
            if (room.scores.p1 >= 5 || room.scores.p2 >= 5) {
                io.to(roomId).emit('gameOver', {
                    winner: room.scores.p1 >= 5 ? 'p1' : 'p2',
                    scores: room.scores
                });
            }
        }
    });
    
    socket.on('disconnect', () => {
        // Clean up rooms
        for (const [roomId, room] of rooms) {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(roomId).emit('playerLeft', socket.id);
                
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

function evaluateRound(room) {
    const moves = {
        'rock': { beats: 'scissors', losesTo: 'paper' },
        'paper': { beats: 'rock', losesTo: 'scissors' },
        'scissors': { beats: 'paper', losesTo: 'rock' }
    };
    
    const p1Move = room.choices.p1;
    const p2Move = room.choices.p2;
    
    if (p1Move === p2Move) {
        return { winner: 'draw', scores: room.scores };
    }
    
    if (moves[p1Move].beats === p2Move) {
        room.scores.p1++;
        return { winner: 'p1', scores: room.scores };
    } else {
        room.scores.p2++;
        return { winner: 'p2', scores: room.scores };
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});