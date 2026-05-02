'use strict';

/**
 * @fileoverview Messages API router — handles team chat messages with
 * pagination, caching, and soft character-limit enforcement.
 * @module routes/messages
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { messagesCache } = require('../utils/cache');
const { validateRequiredString, assertValid, sanitiseString } = require('../utils/validate');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

/** @type {Map<string, import('../types').Message>} In-memory message store */
const messages = new Map();

/** Maximum characters allowed per message. */
const MAX_MESSAGE_LENGTH = 2000;

/** Default page size for paginated responses. */
const DEFAULT_PAGE_LIMIT = 50;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds a cache key for a paginated message list request.
 * @param {string} teamId
 * @param {number} limit
 * @param {number} offset
 * @returns {string}
 */
function buildMessageCacheKey(teamId, limit, offset) {
  return `msgs:${teamId}:${limit}:${offset}`;
}

/**
 * Retrieves a message or throws 404.
 * @param {string} id
 * @returns {import('../types').Message}
 * @throws {NotFoundError}
 */
function getMessageOrThrow(id) {
  const msg = messages.get(id);
  if (!msg) { throw new NotFoundError(`Message '${id}' not found`); }
  return msg;
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * @route GET /api/messages
 * @description Returns paginated messages, optionally filtered by teamId.
 *   Messages are sorted oldest-first. Results are cached per unique query.
 * @query {string} [teamId]  - Filter to a specific team channel
 * @query {number} [limit=50]  - Max messages to return
 * @query {number} [offset=0]  - Pagination offset
 * @returns {{ success: boolean, data: Message[], total: number, limit: number, offset: number }}
 */
router.get('/', (req, res) => {
  const teamId = sanitiseString(req.query.teamId);
  const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const cacheKey = buildMessageCacheKey(teamId, limit, offset);

  const cached = messagesCache.get(cacheKey);
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }

  let allMessages = Array.from(messages.values());
  if (teamId) { allMessages = allMessages.filter((m) => m.teamId === teamId); }

  // Sort ascending so clients display conversation in natural order
  allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const paginated = allMessages.slice(offset, offset + limit);
  const payload = { success: true, data: paginated, total: allMessages.length, limit, offset };
  messagesCache.set(cacheKey, payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route GET /api/messages/:id
 * @description Returns a single message by UUID.
 * @param {string} req.params.id - Message UUID
 * @returns {{ success: boolean, data: Message }}
 */
router.get('/:id', (req, res) => {
  const msg = getMessageOrThrow(req.params.id);
  res.json({ success: true, data: msg });
});

/**
 * @route POST /api/messages
 * @description Persists a new chat message and invalidates paginated caches.
 * @body {{ teamId: string, content: string, sender?: string, senderName?: string }}
 * @returns {{ success: boolean, data: Message }} 201 Created
 */
router.post('/', (req, res) => {
  const { teamId, content, sender, senderName } = req.body;

  assertValid(
    validateRequiredString(teamId, 'teamId', 128),
    validateRequiredString(content, 'content', MAX_MESSAGE_LENGTH)
  );

  /** @type {import('../types').Message} */
  const message = {
    id: uuidv4(),
    teamId: sanitiseString(teamId),
    content: sanitiseString(content),
    sender: sanitiseString(sender) || 'anonymous',
    senderName: sanitiseString(senderName) || 'Anonymous',
    createdAt: new Date().toISOString(),
  };

  messages.set(message.id, message);
  // Invalidate all paginated caches for this team
  messagesCache.invalidatePrefix(`msgs:${message.teamId}`);
  res.status(201).json({ success: true, data: message });
});

/**
 * @route DELETE /api/messages/:id
 * @description Removes a message (soft delete not needed at this scale).
 * @param {string} req.params.id
 * @returns {{ success: boolean, message: string }}
 */
router.delete('/:id', (req, res) => {
  const msg = getMessageOrThrow(req.params.id);
  messages.delete(req.params.id);
  messagesCache.invalidatePrefix(`msgs:${msg.teamId}`);
  res.json({ success: true, message: 'Message deleted successfully' });
});

module.exports = router;
module.exports._messages = messages;
