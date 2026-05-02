'use strict';

/**
 * @fileoverview Tasks API router — manages Kanban-style tasks with filtering,
 * partial updates, and TTL caching for efficient repeated reads.
 * @module routes/tasks
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { tasksCache } = require('../utils/cache');
const { validateRequiredString, validateEnum, assertValid, sanitiseString } = require('../utils/validate');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

/** @type {Map<string, import('../types').Task>} In-memory task store */
const tasks = new Map();

/** @readonly @enum {string} */
const VALID_STATUSES = Object.freeze(['todo', 'in-progress', 'review', 'done']);
/** @readonly @enum {string} */
const VALID_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Retrieves a task by ID or throws 404.
 * @param {string} id
 * @returns {import('../types').Task}
 * @throws {NotFoundError}
 */
function getTaskOrThrow(id) {
  const task = tasks.get(id);
  if (!task) { throw new NotFoundError(`Task '${id}' not found`); }
  return task;
}

/**
 * Builds a cache key from query parameters for list requests.
 * @param {object} query
 * @returns {string}
 */
function buildListKey(query) {
  const { teamId = '', status = '', assignee = '' } = query;
  return `list:${teamId}:${status}:${assignee}`;
}

/** Invalidates all task list caches. */
function invalidateTaskCache(taskId) {
  tasksCache.invalidatePrefix('list:');
  if (taskId) { tasksCache.delete(taskId); }
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * @route GET /api/tasks
 * @description Returns tasks with optional filtering. Cached per query combination.
 * @query {string} [teamId]   - Filter by team
 * @query {string} [status]   - Filter by status
 * @query {string} [assignee] - Filter by assignee name
 * @returns {{ success: boolean, data: Task[], count: number }}
 */
router.get('/', (req, res) => {
  const cacheKey = buildListKey(req.query);
  const cached = tasksCache.get(cacheKey);
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }

  let allTasks = Array.from(tasks.values());
  if (req.query.teamId) { allTasks = allTasks.filter((t) => t.teamId === req.query.teamId); }
  if (req.query.status) { allTasks = allTasks.filter((t) => t.status === req.query.status); }
  if (req.query.assignee) { allTasks = allTasks.filter((t) => t.assignee === req.query.assignee); }

  const payload = { success: true, data: allTasks, count: allTasks.length };
  tasksCache.set(cacheKey, payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route GET /api/tasks/:id
 * @description Returns a single task by UUID.
 * @param {string} req.params.id
 * @returns {{ success: boolean, data: Task }}
 */
router.get('/:id', (req, res) => {
  const cached = tasksCache.get(req.params.id);
  if (cached) {
    return res.set('X-Cache', 'HIT').json(cached);
  }
  const task = getTaskOrThrow(req.params.id);
  const payload = { success: true, data: task };
  tasksCache.set(req.params.id, payload);
  res.set('X-Cache', 'MISS').json(payload);
});

/**
 * @route POST /api/tasks
 * @description Creates a new task and invalidates list caches.
 * @body {{ title: string, description?: string, teamId?: string, assignee?: string,
 *          priority?: Priority, status?: Status, dueDate?: string }}
 * @returns {{ success: boolean, data: Task }} 201 Created
 */
router.post('/', (req, res) => {
  const { title, description, teamId, assignee, priority, status, dueDate } = req.body;

  assertValid(
    validateRequiredString(title, 'Task title', 200),
    validateEnum(priority, 'priority', VALID_PRIORITIES),
    validateEnum(status, 'status', VALID_STATUSES)
  );

  /** @type {import('../types').Task} */
  const task = {
    id: uuidv4(),
    title: sanitiseString(title),
    description: sanitiseString(description),
    teamId: teamId || null,
    assignee: sanitiseString(assignee) || null,
    priority: priority || 'medium',
    status: status || 'todo',
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  invalidateTaskCache();
  res.status(201).json({ success: true, data: task });
});

/**
 * @route PATCH /api/tasks/:id
 * @description Partially updates a task. Only whitelisted fields are mutated.
 * @param {string} req.params.id
 * @body {Partial<Task>}
 * @returns {{ success: boolean, data: Task }}
 */
router.patch('/:id', (req, res) => {
  const task = getTaskOrThrow(req.params.id);

  assertValid(
    validateEnum(req.body.priority, 'priority', VALID_PRIORITIES),
    validateEnum(req.body.status, 'status', VALID_STATUSES)
  );

  const mutableFields = ['title', 'description', 'assignee', 'priority', 'status', 'dueDate', 'teamId'];
  mutableFields.forEach((field) => {
    if (req.body[field] !== undefined) { task[field] = req.body[field]; }
  });
  task.updatedAt = new Date().toISOString();

  tasks.set(task.id, task);
  invalidateTaskCache(task.id);
  res.json({ success: true, data: task });
});

/**
 * @route DELETE /api/tasks/:id
 * @description Permanently removes a task.
 * @param {string} req.params.id
 * @returns {{ success: boolean, message: string }}
 */
router.delete('/:id', (req, res) => {
  getTaskOrThrow(req.params.id);
  tasks.delete(req.params.id);
  invalidateTaskCache(req.params.id);
  res.json({ success: true, message: 'Task deleted successfully' });
});

module.exports = router;
module.exports._tasks = tasks;
