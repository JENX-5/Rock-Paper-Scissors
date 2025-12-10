const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function createRoom(roomId) {
    const room = {
        id: roomId,
        players: {
            p1: null,
            p2: null
        },
        choices: {
            p1: null,
            p2: null
        },
        scores: {
            p1: 0,
            p2: 0
        },
        round: 1
    };
    rooms.set(roomId, room);
    console.log('Room created:', roomId);
    return room;
}

function getRoom(roomId) {
    return rooms.get(roomId);
}

function getAvailableRole(room) {
    if (!room.players.p1) return 'p1';
    if (!room.players.p2) return 'p2';
    return null;
}

function broadcastRoomState(room) {
    const state = {
        p1: room.players.p1,
        p2: room.players.p2,
        scores: room.scores,
        round: room.round
    };
    
    console.log('Broadcasting room state:', state);
    io.to(room.id).emit('players', state);
}

function evaluateRound(room) {
    const choice1 = room.choices.p1;
    const choice2 = room.choices.p2;
    
    if (!choice1 || !choice2) return null;
    
    console.log('Evaluating round:', choice1, 'vs', choice2);
    
    let winner = null;
    
    if (choice1 === choice2) {
        winner = 'draw';
    } else if (
        (choice1 === 'rock' && choice2 === 'scissor') ||
        (choice1 === 'paper' && choice2 === 'rock') ||
        (choice1 === 'scissor' && choice2 === 'paper')
    ) {
        winner = 'p1';
        room.scores.p1++;
    } else {
        winner = 'p2';
        room.scores.p2++;
    }
    
    room.round++;
    room.choices.p1 = null;
    room.choices.p2 = null;
    
    return {
        p1: choice1,
        p2: choice2,
        winner: winner,
        players: {
            p1: room.players.p1,
            p2: room.players.p2
        },
        scores: room.scores,
        round: room.round
    };
}

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    
    socket.on('joinRoom', ({ room, name, skin, mode }) => {
        console.log('Join room request:', { room, name, mode });
        
        if (!room) {
            socket.emit('error', 'Room ID required');
            return;
        }
        
        let roomObj = getRoom(room);
        
        // Create room if it doesn't exist (for PvP)
        if (!roomObj && mode === 'pvp') {
            roomObj = createRoom(room);
        }
        
        if (!roomObj) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        // Check if room is full
        const availableRole = getAvailableRole(roomObj);
        
        if (!availableRole) {
            socket.emit('error', 'Room is full');
            return;
        }
        
        // Create player object
        const player = { 
            id: socket.id, 
            name: name || 'Player', 
            skin: parseInt(skin) || 0,
            score: 0,
            role: availableRole
        };
        
        // Assign player to role
        roomObj.players[availableRole] = player;
        
        // Join socket room
        socket.join(roomObj.id);
        
        // Send join confirmation
        socket.emit('joined', {
            role: availableRole,
            room: roomObj.id,
            opponent: availableRole === 'p1' ? roomObj.players.p2 : roomObj.players.p1
        });
        
        console.log('Player joined:', player);
        
        // Broadcast updated player list
        broadcastRoomState(roomObj);
        
        // Send welcome message
        io.to(roomObj.id).emit('chat', {
            sender: 'System',
            message: `${player.name} joined the game as ${availableRole === 'p1' ? 'Player 1' : 'Player 2'}`
        });
    });
    
    socket.on('play', ({ room, role, choice }) => {
        console.log('Play received:', { room, role, choice });
        
        const roomObj = getRoom(room);
        if (!roomObj) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        // Validate player role
        if (roomObj.players[role]?.id !== socket.id) {
            socket.emit('error', 'Invalid role');
            return;
        }
        
        // Record choice
        roomObj.choices[role] = choice;
        console.log('Choice recorded:', role, choice);
        
        // Notify other player
        io.to(roomObj.id).emit('choiceMade', {
            player: role,
            choice: choice
        });
        
        // Check if both players have chosen
        if (roomObj.choices.p1 && roomObj.choices.p2) {
            const result = evaluateRound(roomObj);
            if (result) {
                console.log('Round result:', result);
                io.to(roomObj.id).emit('result', result);
                
                // Update player scores in room state
                if (result.players.p1) {
                    roomObj.players.p1.score = result.scores.p1;
                }
                if (result.players.p2) {
                    roomObj.players.p2.score = result.scores.p2;
                }
                
                broadcastRoomState(roomObj);
                
                // Check for match winner
                if (result.scores.p1 >= 5 || result.scores.p2 >= 5) {
                    const winner = result.scores.p1 >= 5 ? 'p1' : 'p2';
                    const winnerName = roomObj.players[winner].name;
                    
                    io.to(roomObj.id).emit('matchWinner', {
                        winner: winner,
                        winnerName: winnerName,
                        scores: result.scores
                    });
                }
            }
        }
    });
    
    socket.on('chat', ({ room, sender, message }) => {
        const roomObj = getRoom(room);
        if (roomObj) {
            io.to(roomObj.id).emit('chat', { 
                sender: sender, 
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
        }
    });
    
    socket.on('reset', ({ room }) => {
        const roomObj = getRoom(room);
        if (roomObj) {
            roomObj.scores.p1 = 0;
            roomObj.scores.p2 = 0;
            roomObj.round = 1;
            roomObj.choices.p1 = null;
            roomObj.choices.p2 = null;
            
            // Reset player scores
            if (roomObj.players.p1) {
                roomObj.players.p1.score = 0;
            }
            if (roomObj.players.p2) {
                roomObj.players.p2.score = 0;
            }
            
            broadcastRoomState(roomObj);
            
            io.to(roomObj.id).emit('chat', {
                sender: 'System',
                message: 'Scores have been reset'
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Remove player from all rooms
        for (let [roomId, room] of rooms) {
            let playerRemoved = false;
            
            if (room.players.p1 && room.players.p1.id === socket.id) {
                io.to(roomId).emit('chat', {
                    sender: 'System',
                    message: `${room.players.p1.name} has left the game`
                });
                room.players.p1 = null;
                playerRemoved = true;
            }
            
            if (room.players.p2 && room.players.p2.id === socket.id) {
                io.to(roomId).emit('chat', {
                    sender: 'System',
                    message: `${room.players.p2.name} has left the game`
                });
                room.players.p2 = null;
                playerRemoved = true;
            }
            
            if (playerRemoved) {
                broadcastRoomState(room);
                
                // Clean up empty rooms
                if (!room.players.p1 && !room.players.p2) {
                    rooms.delete(roomId);
                    console.log('Room cleaned up:', roomId);
                }
            }
        }
    });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve cpu.html for CPU mode
app.get('/cpu.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cpu.html'));
});

// Serve pvp.html for PvP mode
app.get('/pvp.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pvp.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the game at http://localhost:${PORT}`);
});