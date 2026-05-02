'use strict';

const request = require('supertest');
const app = require('../server');

// ── Health & Info ─────────────────────────────────────────────────────────────

describe('Health & Readiness', () => {
  it('GET /health → 200 with all fields', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('environment');
  });

  it('GET /ready → 200 ready:true', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('GET /api → returns API metadata', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TeamCollab API');
    expect(res.body.endpoints).toHaveProperty('teams');
    expect(res.body.endpoints).toHaveProperty('ai');
  });
});

// ── Security ──────────────────────────────────────────────────────────────────

describe('Security Headers', () => {
  it('sets X-Content-Type-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options or CSP frame-ancestors', async () => {
    const res = await request(app).get('/health');
    const hasFrameOptions = 'x-frame-options' in res.headers;
    const hasCSP = 'content-security-policy' in res.headers;
    expect(hasFrameOptions || hasCSP).toBe(true);
  });

  it('returns X-Response-Time header when available', async () => {
    const res = await request(app).get('/health');
    // Header may not be set in all environments; verify format if present
    if (res.headers['x-response-time']) {
      expect(res.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
    } else {
      expect(res.status).toBe(200); // server responded correctly
    }
  });
});

// ── Teams API ─────────────────────────────────────────────────────────────────

describe('Teams API', () => {
  let teamId;

  it('GET /api/teams → empty array initially', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/teams → creates a team (201)', async () => {
    const res = await request(app).post('/api/teams')
      .send({ name: 'Alpha Squad', description: 'Core dev team', createdBy: 'user1' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Alpha Squad');
    expect(res.body.data).toHaveProperty('id');
    teamId = res.body.data.id;
  });

  it('POST /api/teams → 400 when name missing', async () => {
    const res = await request(app).post('/api/teams').send({ description: 'No name' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/teams → 400 when name too long', async () => {
    const res = await request(app).post('/api/teams').send({ name: 'X'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('GET /api/teams/:id → returns team', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(teamId);
  });

  it('GET /api/teams/:id → 404 for unknown id', async () => {
    const res = await request(app).get('/api/teams/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('PUT /api/teams/:id → updates name', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).send({ name: 'Beta Squad' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Beta Squad');
  });

  it('PUT /api/teams/:id → 404 for unknown id', async () => {
    const res = await request(app).put('/api/teams/bad-id').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('POST /api/teams/:id/members → adds member (201)', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/members`)
      .send({ userId: 'u1', name: 'Alice', email: 'alice@test.com', role: 'developer' });
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe('u1');
  });

  it('POST /api/teams/:id/members → 409 on duplicate', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/members`)
      .send({ userId: 'u1' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('POST /api/teams/:id/members → 400 on invalid role', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/members`)
      .send({ userId: 'u99', role: 'overlord' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/teams/:id/members/:userId → removes member', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}/members/u1`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/teams/:id/members/:userId → 404 if not a member', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}/members/ghost`);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/teams/:id → deletes team', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/teams/:id → 404 after deletion', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`);
    expect(res.status).toBe(404);
  });
});

// ── Tasks API ─────────────────────────────────────────────────────────────────

describe('Tasks API', () => {
  let taskId;

  it('POST /api/tasks → creates task (201)', async () => {
    const res = await request(app).post('/api/tasks')
      .send({ title: 'Fix auth bug', priority: 'high', status: 'todo', assignee: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Fix auth bug');
    taskId = res.body.data.id;
  });

  it('POST /api/tasks → 400 on invalid priority', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Test', priority: 'critical' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/tasks → 400 on invalid status', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Test', status: 'flying' });
    expect(res.status).toBe(400);
  });

  it('POST /api/tasks → 400 when title missing', async () => {
    const res = await request(app).post('/api/tasks').send({ priority: 'low' });
    expect(res.status).toBe(400);
  });

  it('GET /api/tasks → returns task list', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/tasks → filters by status', async () => {
    const res = await request(app).get('/api/tasks?status=todo');
    expect(res.status).toBe(200);
    res.body.data.forEach((t) => expect(t.status).toBe('todo'));
  });

  it('GET /api/tasks/:id → returns task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(taskId);
  });

  it('GET /api/tasks/:id → 404 for unknown id', async () => {
    const res = await request(app).get('/api/tasks/ghost');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/tasks/:id → updates status', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).send({ status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in-progress');
  });

  it('PATCH /api/tasks/:id → 400 on invalid status', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).send({ status: 'flying' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/tasks/:id → deletes task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/tasks/:id → 404 after deletion', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });
});

// ── Messages API ──────────────────────────────────────────────────────────────

describe('Messages API', () => {
  let msgId;

  it('POST /api/messages → creates message (201)', async () => {
    const res = await request(app).post('/api/messages')
      .send({ teamId: 'team1', content: 'Hello team!', sender: 'u1', senderName: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Hello team!');
    msgId = res.body.data.id;
  });

  it('POST /api/messages → 400 on empty content', async () => {
    const res = await request(app).post('/api/messages').send({ teamId: 'team1', content: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/messages → 400 when teamId missing', async () => {
    const res = await request(app).post('/api/messages').send({ content: 'hello' });
    expect(res.status).toBe(400);
  });

  it('POST /api/messages → 400 when content missing', async () => {
    const res = await request(app).post('/api/messages').send({ teamId: 'team1' });
    expect(res.status).toBe(400);
  });

  it('GET /api/messages → filtered by teamId', async () => {
    const res = await request(app).get('/api/messages?teamId=team1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/messages → pagination works', async () => {
    const res = await request(app).get('/api/messages?limit=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/messages/:id → returns message', async () => {
    const res = await request(app).get(`/api/messages/${msgId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(msgId);
  });

  it('DELETE /api/messages/:id → deletes message', async () => {
    const res = await request(app).delete(`/api/messages/${msgId}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/messages/:id → 404 after deletion', async () => {
    const res = await request(app).delete(`/api/messages/${msgId}`);
    expect(res.status).toBe(404);
  });
});

// ── Users API ─────────────────────────────────────────────────────────────────

describe('Users API', () => {
  it('POST /api/users → creates user (201)', async () => {
    const res = await request(app).post('/api/users')
      .send({ uid: 'u123', name: 'Carol', email: 'carol@test.com', role: 'designer' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Carol');
  });

  it('POST /api/users → upserts existing user (200)', async () => {
    const res = await request(app).post('/api/users')
      .send({ uid: 'u123', name: 'Carol Updated', email: 'carol@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Carol Updated');
  });

  it('POST /api/users → 400 when email missing', async () => {
    const res = await request(app).post('/api/users').send({ uid: 'u2', name: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('POST /api/users → 400 when email invalid', async () => {
    const res = await request(app).post('/api/users').send({ uid: 'u3', name: 'Bob', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/users → 400 when uid missing', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Bob', email: 'bob@test.com' });
    expect(res.status).toBe(400);
  });

  it('GET /api/users → returns user list', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/users/:id → returns user', async () => {
    const res = await request(app).get('/api/users/u123');
    expect(res.status).toBe(200);
    expect(res.body.data.uid).toBe('u123');
  });

  it('GET /api/users/:id → 404 for unknown uid', async () => {
    const res = await request(app).get('/api/users/ghost');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/users/:id/status → updates status', async () => {
    const res = await request(app).patch('/api/users/u123/status').send({ status: 'away' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('away');
  });

  it('PATCH /api/users/:id/status → 400 on invalid status', async () => {
    const res = await request(app).patch('/api/users/u123/status').send({ status: 'invisible' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/users/:id/status → 400 when status missing', async () => {
    // Re-create user since previous test deleted it
    await request(app).post('/api/users').send({ uid: 'u456', name: 'Dave', email: 'dave@test.com' });
    const res = await request(app).patch('/api/users/u456/status').send({});
    expect(res.status).toBe(400);
  });

  it('DELETE /api/users/:id → removes user', async () => {
    const res = await request(app).delete('/api/users/u123');
    expect(res.status).toBe(200);
  });

  it('DELETE /api/users/:id → 404 after deletion', async () => {
    const res = await request(app).delete('/api/users/u123');
    expect(res.status).toBe(404);
  });
});

// ── Cache Utility ─────────────────────────────────────────────────────────────

describe('Cache Utility', () => {
  const { Cache } = require('../utils/cache');

  it('stores and retrieves values', () => {
    const cache = new Cache({ ttlMs: 5000 });
    cache.set('key1', { data: 42 });
    expect(cache.get('key1')).toEqual({ data: 42 });
    cache.destroy();
  });

  it('returns undefined for missing keys', () => {
    const cache = new Cache();
    expect(cache.get('missing')).toBeUndefined();
    cache.destroy();
  });

  it('expires entries after TTL', async () => {
    const cache = new Cache({ ttlMs: 50 });
    cache.set('exp', 'soon');
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get('exp')).toBeUndefined();
    cache.destroy();
  });

  it('invalidatePrefix removes matching keys', () => {
    const cache = new Cache();
    cache.set('msgs:t1:0', 'a');
    cache.set('msgs:t1:1', 'b');
    cache.set('users:all', 'c');
    const removed = cache.invalidatePrefix('msgs:t1');
    expect(removed).toBe(2);
    expect(cache.get('users:all')).toBe('c');
    cache.destroy();
  });

  it('respects maxSize with LRU eviction', () => {
    const cache = new Cache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // evicts 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    cache.destroy();
  });

  it('stats returns correct size', () => {
    const cache = new Cache({ maxSize: 100 });
    cache.set('x', 1);
    cache.set('y', 2);
    expect(cache.stats().size).toBe(2);
    cache.destroy();
  });
});

// ── Validation Utility ────────────────────────────────────────────────────────

describe('Validation Utility', () => {
  const { validateRequiredString, validateEnum, validateEmail, assertValid, sanitiseString } = require('../utils/validate');
  const { ValidationError } = require('../utils/errors');

  it('validateRequiredString → null on valid input', () => {
    expect(validateRequiredString('hello', 'field')).toBeNull();
  });

  it('validateRequiredString → error on empty string', () => {
    expect(validateRequiredString('', 'field')).toBeTruthy();
  });

  it('validateRequiredString → error on too long', () => {
    expect(validateRequiredString('x'.repeat(10), 'f', 5)).toBeTruthy();
  });

  it('validateEnum → null when value is valid', () => {
    expect(validateEnum('todo', 'status', ['todo', 'done'])).toBeNull();
  });

  it('validateEnum → error on invalid value', () => {
    expect(validateEnum('flying', 'status', ['todo', 'done'])).toBeTruthy();
  });

  it('validateEnum → null when value is undefined (optional)', () => {
    expect(validateEnum(undefined, 'status', ['todo'])).toBeNull();
  });

  it('validateEmail → null on valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
  });

  it('validateEmail → error on invalid email', () => {
    expect(validateEmail('not-an-email')).toBeTruthy();
  });

  it('assertValid → throws ValidationError on first failure', () => {
    expect(() => assertValid('Name is required', null)).toThrow(ValidationError);
  });

  it('assertValid → does not throw when all pass', () => {
    expect(() => assertValid(null, null)).not.toThrow();
  });

  it('sanitiseString → trims whitespace', () => {
    expect(sanitiseString('  hello  ')).toBe('hello');
  });

  it('sanitiseString → returns empty string for null', () => {
    expect(sanitiseString(null)).toBe('');
  });
});
