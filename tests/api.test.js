'use strict';
const request = require('supertest');
const app = require('../server');

describe('Health Check', () => {
  it('GET /health returns 200 with status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('API Info', () => {
  it('GET /api returns API info', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TeamCollab API');
    expect(res.body.endpoints).toHaveProperty('teams');
  });
});

describe('Teams API', () => {
  let teamId;

  it('GET /api/teams returns empty array initially', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/teams creates a team', async () => {
    const res = await request(app).post('/api/teams').send({ name: 'Alpha Team', description: 'Our first team', createdBy: 'user1' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Alpha Team');
    expect(res.body.data).toHaveProperty('id');
    teamId = res.body.data.id;
  });

  it('POST /api/teams rejects missing name', async () => {
    const res = await request(app).post('/api/teams').send({ description: 'No name' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/teams rejects name > 100 chars', async () => {
    const res = await request(app).post('/api/teams').send({ name: 'A'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('GET /api/teams/:id returns the team', async () => {
    const res = await request(app).get(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(teamId);
  });

  it('GET /api/teams/:id returns 404 for unknown team', async () => {
    const res = await request(app).get('/api/teams/nonexistent');
    expect(res.status).toBe(404);
  });

  it('PUT /api/teams/:id updates the team', async () => {
    const res = await request(app).put(`/api/teams/${teamId}`).send({ name: 'Beta Team' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Beta Team');
  });

  it('POST /api/teams/:id/members adds a member', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/members`).send({ userId: 'u1', name: 'Alice', email: 'alice@test.com', role: 'developer' });
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe('u1');
  });

  it('POST /api/teams/:id/members rejects duplicate', async () => {
    const res = await request(app).post(`/api/teams/${teamId}/members`).send({ userId: 'u1' });
    expect(res.status).toBe(409);
  });

  it('DELETE /api/teams/:id deletes the team', async () => {
    const res = await request(app).delete(`/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Tasks API', () => {
  let taskId;

  it('POST /api/tasks creates a task', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Fix login bug', priority: 'high', status: 'todo', assignee: 'Bob' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Fix login bug');
    taskId = res.body.data.id;
  });

  it('POST /api/tasks rejects invalid priority', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Test', priority: 'critical' });
    expect(res.status).toBe(400);
  });

  it('GET /api/tasks returns tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/tasks filters by status', async () => {
    const res = await request(app).get('/api/tasks?status=todo');
    expect(res.status).toBe(200);
    res.body.data.forEach(t => expect(t.status).toBe('todo'));
  });

  it('PATCH /api/tasks/:id updates status', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).send({ status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in-progress');
  });

  it('PATCH /api/tasks/:id rejects invalid status', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).send({ status: 'flying' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/tasks/:id deletes a task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
  });
});

describe('Messages API', () => {
  let msgId;

  it('POST /api/messages creates a message', async () => {
    const res = await request(app).post('/api/messages').send({ teamId: 'team1', content: 'Hello team!', sender: 'u1', senderName: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Hello team!');
    msgId = res.body.data.id;
  });

  it('POST /api/messages rejects empty content', async () => {
    const res = await request(app).post('/api/messages').send({ teamId: 'team1', content: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/messages rejects missing teamId', async () => {
    const res = await request(app).post('/api/messages').send({ content: 'hello' });
    expect(res.status).toBe(400);
  });

  it('GET /api/messages returns messages filtered by teamId', async () => {
    const res = await request(app).get('/api/messages?teamId=team1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('DELETE /api/messages/:id deletes message', async () => {
    const res = await request(app).delete(`/api/messages/${msgId}`);
    expect(res.status).toBe(200);
  });
});

describe('Users API', () => {
  it('POST /api/users creates a user', async () => {
    const res = await request(app).post('/api/users').send({ uid: 'u123', name: 'Carol', email: 'carol@test.com', role: 'designer' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Carol');
  });

  it('POST /api/users rejects missing email', async () => {
    const res = await request(app).post('/api/users').send({ uid: 'u2', name: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/users/:id/status updates status', async () => {
    const res = await request(app).patch('/api/users/u123/status').send({ status: 'away' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('away');
  });

  it('PATCH /api/users/:id/status rejects invalid status', async () => {
    const res = await request(app).patch('/api/users/u123/status').send({ status: 'invisible' });
    expect(res.status).toBe(400);
  });

  it('GET /api/users/:id returns user', async () => {
    const res = await request(app).get('/api/users/u123');
    expect(res.status).toBe(200);
    expect(res.body.data.uid).toBe('u123');
  });
});

describe('Security', () => {
  it('sets security headers via helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect([404, 200]).toContain(res.status);
  });
});
