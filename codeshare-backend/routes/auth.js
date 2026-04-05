const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '48h' }
  );
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password)
      return res.status(400).json({ error: 'Email, username and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      passwordHash,
      plan: 'FREE',
      planSelectedAt: null, // null = plan not yet chosen via pricing page
    });

    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        planChosen: !!user.planSelectedAt,
        codeshareCount: user.codeshareCount,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        planChosen: !!user.planSelectedAt,
        codeshareCount: user.codeshareCount,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Used on app load to validate stored JWT and restore session
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        planChosen: !!user.planSelectedAt,
        codeshareCount: user.codeshareCount,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PUT /api/auth/plan ────────────────────────────────────────────────────────
// Called from Pricing Page when user selects a plan
router.put('/plan', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['FREE', 'PRO', 'PREMIUM'].includes(plan))
      return res.status(400).json({ error: 'Invalid plan. Must be FREE, PRO, or PREMIUM.' });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { plan, planSelectedAt: new Date() },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        planChosen: true,
        codeshareCount: user.codeshareCount,
      },
    });
  } catch (err) {
    console.error('Plan update error:', err);
    res.status(500).json({ error: 'Server error updating plan.' });
  }
});

module.exports = router;
