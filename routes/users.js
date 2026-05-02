'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const users = new Map();

/**
 * GET /api/users
 */
router.get('/', (req, res) => {
  const allUsers = Array.from(users.values()).map(u => ({ ...u, password: undefined }));
  res.json({ success: true, data: allUsers, count: allUsers.length });
});

/**
 * GET /api/users/:id
 */
router.get('/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { password, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

/**
 * POST /api/users
 * Registers a user profile (auth handled by Firebase on client)
 */
router.post('/', (req, res) => {
  const { uid, name, email, photoURL, role } = req.body;

  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' });
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email is required' });
  }

  if (users.has(uid)) {
    // Update existing
    const user = users.get(uid);
    user.name = name.trim();
    user.email = email.trim();
    if (photoURL) user.photoURL = photoURL;
    user.updatedAt = new Date().toISOString();
    users.set(uid, user);
    return res.json({ success: true, data: { ...user } });
  }

  const user = {
    uid,
    name: name.trim(),
    email: email.trim(),
    photoURL: photoURL || '',
    role: role || 'member',
    status: 'online',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.set(uid, user);
  res.status(201).json({ success: true, data: user });
});

/**
 * PATCH /api/users/:id/status
 * Update user online status
 */
router.patch('/:id/status', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { status } = req.body;
  const validStatuses = ['online', 'away', 'busy', 'offline'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  user.status = status;
  user.updatedAt = new Date().toISOString();
  users.set(user.uid, user);
  res.json({ success: true, data: user });
});

module.exports = router;
module.exports._users = users;
