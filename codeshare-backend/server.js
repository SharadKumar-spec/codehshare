require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');

// ── Routes & Middleware ───────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const { optionalToken, checkPlanLimits, PLAN_LIMITS } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/codeshare')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.warn('⚠️  MongoDB not connected (guest-only mode):', err.message));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── In-memory room store ──────────────────────────────────────────────────────
// rooms: { [roomId]: { code, language, users: { [socketId]: { name, color, plan } }, chat: [] } }
const rooms = {};

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
];

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      code: '// Start coding here...\n',
      language: 'javascript',
      users: {},
      chat: [],
      viewOnlyMode: false,
    };
  }
  return rooms[roomId];
}

// ── REST: Create a room ───────────────────────────────────────────────────────
app.post('/api/rooms', optionalToken, checkPlanLimits, async (req, res) => {
  const roomId = nanoid(8);
  const room = getRoom(roomId);

  const ownerToken = nanoid(16);
  room.ownerToken = ownerToken;
  room.ownerId = req.userId || null;

  // Increment codeshare count for authenticated users
  if (req.dbUser) {
    try {
      req.dbUser.codeshareCount += 1;
      await req.dbUser.save();
    } catch (e) {
      console.warn('Could not increment codeshare count:', e.message);
    }
  }

  res.json({ roomId, plan: req.userPlan || 'GUEST', ownerToken });
});

// ── REST: Get room info ───────────────────────────────────────────────────────
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (rooms[roomId]) {
    const room = rooms[roomId];
    res.json({
      exists: true,
      userCount: Object.keys(room.users).length,
      language: room.language,
      viewOnlyMode: room.viewOnlyMode,
    });
  } else {
    res.json({ exists: false });
  }
});

// ── REST: Toggle view-only mode (PRO/PREMIUM only) ────────────────────────────
app.post('/api/rooms/:roomId/view-only', optionalToken, async (req, res) => {
  const { roomId } = req.params;
  const { enabled, ownerToken } = req.body;

  if (!rooms[roomId]) return res.status(404).json({ error: 'Room not found' });
  const room = rooms[roomId];

  // Must be authenticated and PRO/PREMIUM
  if (!req.userId) return res.status(403).json({ error: 'Login required', code: 'AUTH_REQUIRED' });

  const isOwner = (ownerToken && room.ownerToken === ownerToken) || (req.userId && room.ownerId === req.userId);
  if (!isOwner) return res.status(403).json({ error: 'Only the room creator can toggle view mode', code: 'NOT_OWNER' });

  const User = require('./models/User');
  const user = await User.findById(req.userId);
  if (!user || !['PRO', 'PREMIUM'].includes(user.plan)) {
    return res.status(403).json({ error: 'PRO or PREMIUM plan required', code: 'PLAN_REQUIRED' });
  }

  rooms[roomId].viewOnlyMode = !!enabled;
  io.to(roomId).emit('view-only-update', { enabled: rooms[roomId].viewOnlyMode });
  res.json({ viewOnlyMode: rooms[roomId].viewOnlyMode });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', ({ roomId, username, plan = 'GUEST', ownerToken }) => {
    const room = getRoom(roomId);

    // Enforce collaborator limits
    const currentCount = Object.keys(room.users).length;
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS['GUEST'];

    if (limit.maxCollaborators !== Infinity && currentCount >= limit.maxCollaborators) {
      // Notify the joining user they've hit the limit
      socket.emit('collab-limit-reached', {
        plan,
        limit: limit.maxCollaborators,
        message: `This room is full for your plan (${plan}: max ${limit.maxCollaborators} users). Upgrade for unlimited collaborators.`,
      });
      // Still allow them to join as view-only observer (they just can't edit)
    }

    const colorIndex = currentCount % USER_COLORS.length;
    const color = USER_COLORS[colorIndex];

    room.users[socket.id] = { name: username || 'Anonymous', color, plan };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userPlan = plan;

    // Send current code snapshot + view-only state
    const isOwner = !!(ownerToken && room.ownerToken === ownerToken);
    socket.emit('init-code', {
      code: room.code,
      language: room.language,
      viewOnlyMode: room.viewOnlyMode,
      isOwner,
    });

    // Broadcast updated user list
    const userList = Object.values(room.users);
    io.to(roomId).emit('users-update', userList);

    socket.to(roomId).emit('user-joined', { name: room.users[socket.id].name, color });
    socket.emit('chat-history', room.chat);

    console.log(`  User "${room.users[socket.id].name}" [${plan}] joined room ${roomId}. Total: ${userList.length}`);
  });

  // Code change (blocked if view-only)
  socket.on('code-change', ({ roomId, code }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].viewOnlyMode) return; // silently ignore
    rooms[roomId].code = code;
    socket.to(roomId).emit('code-update', { code });
  });

  // Language change
  socket.on('language-change', ({ roomId, language }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].language = language;
    io.to(roomId).emit('language-update', { language });
  });

  // Chat message
  socket.on('chat-message', ({ roomId, message }) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    const sender = room.users[socket.id];
    if (!sender) return;

    const msg = {
      id: nanoid(6),
      name: sender.name,
      color: sender.color,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    io.to(roomId).emit('chat-message', msg);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      const user = room.users[socket.id];
      delete room.users[socket.id];

      const userList = Object.values(room.users);
      io.to(roomId).emit('users-update', userList);

      if (user) {
        socket.to(roomId).emit('user-left', { name: user.name });
        console.log(`  User "${user.name}" left room ${roomId}. Total: ${userList.length}`);
      }

      // Clean up empty rooms after 10 min
      if (userList.length === 0) {
        setTimeout(() => {
          if (rooms[roomId] && Object.keys(rooms[roomId].users).length === 0) {
            delete rooms[roomId];
            console.log(`  Room ${roomId} cleaned up (empty).`);
          }
        }, 10 * 60 * 1000);
      }
    }
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 CodeShare backend running on http://localhost:${PORT}\n`);
});
