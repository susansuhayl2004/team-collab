'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory store (Firebase would be used in production with service account)
const teams = new Map();

/**
 * GET /api/teams
 * Returns all teams
 */
router.get('/', (req, res) => {
  const allTeams = Array.from(teams.values());
  res.json({ success: true, data: allTeams, count: allTeams.length });
});

/**
 * GET /api/teams/:id
 * Returns a single team by ID
 */
router.get('/:id', (req, res) => {
  const team = teams.get(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }
  res.json({ success: true, data: team });
});

/**
 * POST /api/teams
 * Creates a new team
 */
router.post('/', (req, res) => {
  const { name, description, createdBy } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Team name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Team name must be 100 characters or less' });
  }

  const team = {
    id: uuidv4(),
    name: name.trim(),
    description: description ? description.trim() : '',
    createdBy: createdBy || 'anonymous',
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  teams.set(team.id, team);
  res.status(201).json({ success: true, data: team });
});

/**
 * PUT /api/teams/:id
 * Updates a team
 */
router.put('/:id', (req, res) => {
  const team = teams.get(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }

  const { name, description } = req.body;
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Team name cannot be empty' });
    }
    team.name = name.trim();
  }
  if (description !== undefined) team.description = description.trim();
  team.updatedAt = new Date().toISOString();

  teams.set(team.id, team);
  res.json({ success: true, data: team });
});

/**
 * DELETE /api/teams/:id
 * Deletes a team
 */
router.delete('/:id', (req, res) => {
  if (!teams.has(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }
  teams.delete(req.params.id);
  res.json({ success: true, message: 'Team deleted successfully' });
});

/**
 * POST /api/teams/:id/members
 * Adds a member to a team
 */
router.post('/:id/members', (req, res) => {
  const team = teams.get(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, error: 'Team not found' });
  }

  const { userId, name, email, role } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  const existingMember = team.members.find(m => m.userId === userId);
  if (existingMember) {
    return res.status(409).json({ success: false, error: 'User is already a member' });
  }

  const member = { userId, name: name || 'Unknown', email: email || '', role: role || 'member', joinedAt: new Date().toISOString() };
  team.members.push(member);
  team.updatedAt = new Date().toISOString();

  teams.set(team.id, team);
  res.status(201).json({ success: true, data: member });
});

module.exports = router;
module.exports._teams = teams; // exported for testing
