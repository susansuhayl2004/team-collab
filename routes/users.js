'use strict';

/**
 * @fileoverview Users API router — manages user profiles and online presence.
 * Passwords are never stored; authentication is delegated to Firebase Auth
 * on the client. This service stores profile metadata only.
 * @module routes/users
 */

const express = require('express');
const { usersCache } = require('../utils/cache');
const { validateRequiredString, validateEnum, validateEmail, assertValid, sanitiseString } = require('../utils/validate');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

/** @type {Map<string, import('../types').User>} In-memory user store */
const users = new Map();

/** @readonly Allowed presence statuses */
const VALID_STATUSES = Object.freeze(['online', 'away', 'busy', 'offline']);

/** @readonly Allowed user roles within a workspace */
const VALID_ROLES = Object.freeze(['admin', 'lead', 'developer', 'designer', 'member']);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Retrieves a user profile or throws 404.
 * @param {string} uid - Firebase UID
 * @returns {import('../types').User}
 * @throws {NotFoundError}
 */
function getUserOrThrow(uid) {
  const user = users.get(uid);
  if (!user) { throw new NotFoundError(`User '${uid}' not found`); }
  return user;
}

/**
 * Returns a safe user object with no sensitive fields.
 * @param {import('../types').User} user
 * @returns {object}
 */
function safeUser(user) {
  const { ...safe } = user;
  return safe;
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * @route GET /api/users
 * @description Returns all user profiles (sensitive fields excluded). Cached.
 * @returns {{ success: boolean, data: User[], count: number }}
 */
router.get('/', (req, res) => {
  const cached = usersCache.get('all');
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }
  const allUsers = Array.from(users.values()).map(safeUser);
  const payload = { success: true, data: allUsers, count: allUsers.length };
  usersCache.set('all', payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route GET /api/users/:id
 * @description Returns a single user profile by Firebase UID.
 * @param {string} req.params.id - Firebase UID
 * @returns {{ success: boolean, data: User }}
 */
router.get('/:id', (req, res) => {
  const cached = usersCache.get(req.params.id);
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }
  const user = getUserOrThrow(req.params.id);
  const payload = { success: true, data: safeUser(user) };
  usersCache.set(req.params.id, payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route POST /api/users
 * @description Creates or updates a user profile (upsert semantics).
 *   Called after Firebase Sign-In to register the user in the platform.
 * @body {{ uid: string, name: string, email: string, photoURL?: string, role?: string }}
 * @returns {{ success: boolean, data: User }} 200 on update, 201 on create
 */
router.post('/', (req, res) => {
  const { uid, name, email, photoURL, role } = req.body;

  assertValid(
    validateRequiredString(uid, 'uid', 128),
    validateRequiredString(name, 'name', 100),
    validateEmail(email),
    validateEnum(role, 'role', VALID_ROLES)
  );

  const isUpdate = users.has(uid);

  if (isUpdate) {
    const existing = users.get(uid);
    existing.name = sanitiseString(name);
    existing.email = sanitiseString(email);
    if (photoURL !== undefined) { existing.photoURL = sanitiseString(photoURL); }
    existing.updatedAt = new Date().toISOString();
    users.set(uid, existing);
    usersCache.delete(uid);
    usersCache.delete('all');
    return res.json({ success: true, data: safeUser(existing) });
  }

  /** @type {import('../types').User} */
  const user = {
    uid,
    name: sanitiseString(name),
    email: sanitiseString(email),
    photoURL: sanitiseString(photoURL),
    role: role || 'member',
    status: 'online',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.set(uid, user);
  usersCache.delete('all');
  res.status(201).json({ success: true, data: safeUser(user) });
});

/**
 * @route PATCH /api/users/:id/status
 * @description Updates a user's presence status (online / away / busy / offline).
 * @param {string} req.params.id - Firebase UID
 * @body {{ status: PresenceStatus }}
 * @returns {{ success: boolean, data: User }}
 */
router.patch('/:id/status', (req, res) => {
  const user = getUserOrThrow(req.params.id);
  assertValid(validateEnum(req.body.status, 'status', VALID_STATUSES));

  if (!req.body.status) {
    return res.status(400).json({ success: false, error: 'status is required' });
  }

  user.status = req.body.status;
  user.updatedAt = new Date().toISOString();
  users.set(user.uid, user);
  usersCache.delete(user.uid);
  usersCache.delete('all');
  res.json({ success: true, data: safeUser(user) });
});

/**
 * @route DELETE /api/users/:id
 * @description Removes a user profile from the platform.
 * @param {string} req.params.id
 * @returns {{ success: boolean, message: string }}
 */
router.delete('/:id', (req, res) => {
  getUserOrThrow(req.params.id);
  users.delete(req.params.id);
  usersCache.delete(req.params.id);
  usersCache.delete('all');
  res.json({ success: true, message: 'User removed successfully' });
});

module.exports = router;
module.exports._users = users;
