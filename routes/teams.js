'use strict';

/**
 * @fileoverview Teams API router — full CRUD for team management.
 * Responses are cached with a 30-second TTL; writes invalidate affected keys.
 * @module routes/teams
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { teamsCache } = require('../utils/cache');
const { validateRequiredString, validateEnum, assertValid, sanitiseString } = require('../utils/validate');
const { NotFoundError, ConflictError } = require('../utils/errors');

const router = express.Router();

/** @type {Map<string, import('../types').Team>} In-memory team store */
const teams = new Map();

const VALID_ROLES = ['admin', 'lead', 'developer', 'designer', 'member'];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Retrieves a team by ID or throws a 404 NotFoundError.
 * @param {string} id - Team UUID
 * @returns {import('../types').Team} The found team
 * @throws {NotFoundError}
 */
function getTeamOrThrow(id) {
  const team = teams.get(id);
  if (!team) { throw new NotFoundError(`Team '${id}' not found`); }
  return team;
}

/**
 * Invalidates all cache entries related to a team.
 * @param {string} [teamId] - Optional specific team ID
 * @returns {void}
 */
function invalidateTeamCache(teamId) {
  teamsCache.delete('all');
  if (teamId) { teamsCache.delete(teamId); }
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * @route GET /api/teams
 * @description Returns all teams. Result is cached for 30 seconds.
 * @returns {{ success: boolean, data: Team[], count: number }}
 */
router.get('/', (req, res) => {
  const cached = teamsCache.get('all');
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }
  const allTeams = Array.from(teams.values());
  const payload = { success: true, data: allTeams, count: allTeams.length };
  teamsCache.set('all', payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route GET /api/teams/:id
 * @description Returns a single team by UUID. Cached individually.
 * @param {string} req.params.id - Team UUID
 * @returns {{ success: boolean, data: Team }}
 */
router.get('/:id', (req, res) => {
  const cached = teamsCache.get(req.params.id);
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }
  const team = getTeamOrThrow(req.params.id);
  const payload = { success: true, data: team };
  teamsCache.set(req.params.id, payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route POST /api/teams
 * @description Creates a new team. Invalidates the collection cache.
 * @body {{ name: string, description?: string, createdBy?: string }}
 * @returns {{ success: boolean, data: Team }} 201 Created
 */
router.post('/', (req, res) => {
  const { name, description, createdBy } = req.body;
  assertValid(validateRequiredString(name, 'Team name', 100));

  /** @type {import('../types').Team} */
  const team = {
    id: uuidv4(),
    name: sanitiseString(name),
    description: sanitiseString(description),
    createdBy: sanitiseString(createdBy) || 'anonymous',
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  teams.set(team.id, team);
  invalidateTeamCache();
  res.status(201).json({ success: true, data: team });
});

/**
 * @route PUT /api/teams/:id
 * @description Replaces mutable fields on an existing team.
 * @param {string} req.params.id
 * @body {{ name?: string, description?: string }}
 * @returns {{ success: boolean, data: Team }}
 */
router.put('/:id', (req, res) => {
  const team = getTeamOrThrow(req.params.id);
  const { name, description } = req.body;

  if (name !== undefined) {
    assertValid(validateRequiredString(name, 'Team name', 100));
    team.name = sanitiseString(name);
  }
  if (description !== undefined) {
    team.description = sanitiseString(description);
  }
  team.updatedAt = new Date().toISOString();

  teams.set(team.id, team);
  invalidateTeamCache(team.id);
  res.json({ success: true, data: team });
});

/**
 * @route DELETE /api/teams/:id
 * @description Permanently deletes a team and its cache entries.
 * @param {string} req.params.id
 * @returns {{ success: boolean, message: string }}
 */
router.delete('/:id', (req, res) => {
  getTeamOrThrow(req.params.id); // ensures 404 if not found
  teams.delete(req.params.id);
  invalidateTeamCache(req.params.id);
  res.json({ success: true, message: 'Team deleted successfully' });
});

/**
 * @route POST /api/teams/:id/members
 * @description Adds a member to a team. Returns 409 if already a member.
 * @param {string} req.params.id - Team UUID
 * @body {{ userId: string, name?: string, email?: string, role?: string }}
 * @returns {{ success: boolean, data: TeamMember }} 201 Created
 */
router.post('/:id/members', (req, res) => {
  const team = getTeamOrThrow(req.params.id);
  const { userId, name, email, role } = req.body;

  assertValid(
    validateRequiredString(userId, 'userId', 128),
    validateEnum(role, 'role', VALID_ROLES)
  );

  const duplicate = team.members.find((m) => m.userId === userId);
  if (duplicate) { throw new ConflictError('User is already a team member'); }

  /** @type {import('../types').TeamMember} */
  const member = {
    userId,
    name: sanitiseString(name) || 'Unknown',
    email: sanitiseString(email),
    role: role || 'member',
    joinedAt: new Date().toISOString(),
  };

  team.members.push(member);
  team.updatedAt = new Date().toISOString();
  teams.set(team.id, team);
  invalidateTeamCache(team.id);

  res.status(201).json({ success: true, data: member });
});

/**
 * @route DELETE /api/teams/:id/members/:userId
 * @description Removes a member from a team.
 * @returns {{ success: boolean, message: string }}
 */
router.delete('/:id/members/:userId', (req, res) => {
  const team = getTeamOrThrow(req.params.id);
  const idx = team.members.findIndex((m) => m.userId === req.params.userId);
  if (idx === -1) { throw new NotFoundError('Member not found in this team'); }

  team.members.splice(idx, 1);
  team.updatedAt = new Date().toISOString();
  teams.set(team.id, team);
  invalidateTeamCache(team.id);

  res.json({ success: true, message: 'Member removed successfully' });
});

module.exports = router;
module.exports._teams = teams;
