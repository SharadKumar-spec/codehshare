const jwt = require('jsonwebtoken');
const User = require('../models/User');

const PLAN_LIMITS = {
  GUEST: { maxCollaborators: 2, maxCodeshares: 0 },
  FREE:  { maxCollaborators: 3, maxCodeshares: 3 },
  PRO:   { maxCollaborators: Infinity, maxCodeshares: Infinity },
  PREMIUM: { maxCollaborators: Infinity, maxCodeshares: Infinity },
};

// ── Hard auth: requires valid JWT ────────────────────────────────────────────
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Soft auth: attaches user if token present, continues as guest if not ─────
function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.userId = null;
    req.userPlan = 'GUEST';
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    // plan resolved in checkPlanLimits
  } catch {
    req.userId = null;
    req.userPlan = 'GUEST';
  }
  next();
}

// ── Plan limits: check if user can create a new codeshare ────────────────────
async function checkPlanLimits(req, res, next) {
  try {
    if (!req.userId) {
      // guest — allow creating rooms but don't increment counter
      req.userPlan = 'GUEST';
      return next();
    }

    const user = await User.findById(req.userId);
    if (!user) {
      req.userPlan = 'GUEST';
      return next();
    }

    req.userPlan = user.plan;
    req.dbUser = user;

    const limits = PLAN_LIMITS[user.plan];
    if (limits.maxCodeshares !== Infinity && user.codeshareCount >= limits.maxCodeshares) {
      return res.status(403).json({
        error: 'Plan limit reached',
        code: 'CODESHARE_LIMIT',
        plan: user.plan,
        limit: limits.maxCodeshares,
        message: `Your ${user.plan} plan allows a maximum of ${limits.maxCodeshares} saved codeshares. Please upgrade.`,
      });
    }

    next();
  } catch (err) {
    console.error('checkPlanLimits error:', err);
    next(); // fail open — don't block users on DB errors
  }
}

module.exports = { verifyToken, optionalToken, checkPlanLimits, PLAN_LIMITS };
