'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const tasks = new Map();

const VALID_STATUSES = ['todo', 'in-progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/**
 * GET /api/tasks
 * Returns all tasks, optionally filtered by teamId
 */
router.get('/', (req, res) => {
  let allTasks = Array.from(tasks.values());
  if (req.query.teamId) allTasks = allTasks.filter(t => t.teamId === req.query.teamId);
  if (req.query.status) allTasks = allTasks.filter(t => t.status === req.query.status);
  if (req.query.assignee) allTasks = allTasks.filter(t => t.assignee === req.query.assignee);
  res.json({ success: true, data: allTasks, count: allTasks.length });
});

/**
 * GET /api/tasks/:id
 */
router.get('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  res.json({ success: true, data: task });
});

/**
 * POST /api/tasks
 */
router.post('/', (req, res) => {
  const { title, description, teamId, assignee, priority, dueDate, status } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ success: false, error: 'Title must be 200 characters or less' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const task = {
    id: uuidv4(),
    title: title.trim(),
    description: description ? description.trim() : '',
    teamId: teamId || null,
    assignee: assignee || null,
    priority: priority || 'medium',
    status: status || 'todo',
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.set(task.id, task);
  res.status(201).json({ success: true, data: task });
});

/**
 * PATCH /api/tasks/:id
 * Partially update a task (e.g. change status)
 */
router.patch('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

  const allowed = ['title', 'description', 'assignee', 'priority', 'status', 'dueDate'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) task[field] = req.body[field];
  });

  if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  task.updatedAt = new Date().toISOString();
  tasks.set(task.id, task);
  res.json({ success: true, data: task });
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', (req, res) => {
  if (!tasks.has(req.params.id)) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }
  tasks.delete(req.params.id);
  res.json({ success: true, message: 'Task deleted successfully' });
});

module.exports = router;
module.exports._tasks = tasks;
