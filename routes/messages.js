'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const messages = new Map();

/**
 * GET /api/messages
 * Returns messages, filtered by teamId
 */
router.get('/', (req, res) => {
  let allMessages = Array.from(messages.values());
  if (req.query.teamId) allMessages = allMessages.filter(m => m.teamId === req.query.teamId);
  // Sort by createdAt ascending
  allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const paginated = allMessages.slice(offset, offset + limit);
  res.json({ success: true, data: paginated, total: allMessages.length, limit, offset });
});

/**
 * POST /api/messages
 */
router.post('/', (req, res) => {
  const { teamId, content, sender, senderName } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message content is required' });
  }
  if (content.trim().length > 2000) {
    return res.status(400).json({ success: false, error: 'Message must be 2000 characters or less' });
  }
  if (!teamId) {
    return res.status(400).json({ success: false, error: 'teamId is required' });
  }

  const message = {
    id: uuidv4(),
    teamId,
    content: content.trim(),
    sender: sender || 'anonymous',
    senderName: senderName || 'Anonymous',
    createdAt: new Date().toISOString(),
  };

  messages.set(message.id, message);
  res.status(201).json({ success: true, data: message });
});

/**
 * DELETE /api/messages/:id
 */
router.delete('/:id', (req, res) => {
  if (!messages.has(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Message not found' });
  }
  messages.delete(req.params.id);
  res.json({ success: true, message: 'Message deleted successfully' });
});

module.exports = router;
module.exports._messages = messages;
