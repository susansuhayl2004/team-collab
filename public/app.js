// TeamCollab – Frontend App
// Firebase for real-time features + Gemini AI via backend

// ── Firebase Config ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDuWqC7Hhbw24obIImEpw24PUmN4vzKvr4",
  authDomain: "teamcollab-8c854.firebaseapp.com",
  projectId: "teamcollab-8c854",
  storageBucket: "teamcollab-8c854.firebasestorage.app",
  messagingSenderId: "669739286536",
  appId: "1:669739286536:web:80f782eb8462322bfc11bd"
};

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  user: null,
  tasks: [],
  messages: [],
  members: [],
  currentView: 'dashboard',
  demoMode: false,
  unreadCount: 0,
};

// ── DOM Helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = s => document.querySelector(s);

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const view = $(`view-${viewId}`);
  if (view) { view.classList.remove('hidden'); }
  const navBtn = qs(`[data-view="${viewId}"]`);
  if (navBtn) { navBtn.classList.add('active'); navBtn.setAttribute('aria-current', 'page'); }
  $('page-title').textContent = { dashboard:'Dashboard', kanban:'Kanban Board', chat:'Team Chat', ai:'AI Assistant', team:'Team Members' }[viewId] || viewId;
  state.currentView = viewId;
  if (viewId === 'chat') { state.unreadCount = 0; updateMsgBadge(); }
  if (viewId === 'kanban') renderKanban();
  if (viewId === 'dashboard') updateDashboard();
  if (viewId === 'team') renderTeam();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
      = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    $('google-signin-btn').addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        showToast('Sign-in failed. Try demo mode.', 'error');
      }
    });

    onAuthStateChanged(auth, user => {
      if (user) {
        state.user = { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL };
        enterApp();
        subscribeFirestoreMessages(db, collection, query, orderBy, limit, onSnapshot, serverTimestamp);
      } else {
        showAuthScreen();
      }
    });

    window._firebaseSignOut = () => signOut(auth);
    window._firestoreAddMessage = async (content) => {
      await addDoc(collection(db, 'messages'), {
        content, sender: state.user.uid, senderName: state.user.name,
        teamId: 'general', createdAt: serverTimestamp()
      });
    };
  } catch (e) {
    console.warn('Firebase not configured, using demo mode:', e.message);
    startDemoMode();
  }
}

function subscribeFirestoreMessages(db, collection, query, orderBy, limit, onSnapshot, serverTimestamp) {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(100));
  onSnapshot(q, snapshot => {
    state.messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.currentView === 'chat') renderMessages();
    else { state.unreadCount++; updateMsgBadge(); }
  });
}

// ── Demo Mode ─────────────────────────────────────────────────────────────────
function startDemoMode() {
  state.demoMode = true;
  state.user = { uid: 'demo-user', name: 'Demo User', email: 'demo@teamcollab.app', photo: '' };
  state.tasks = [
    { id:'t1', title:'Design landing page', description:'Create hero section and CTA', priority:'high', status:'todo', assignee:'Alice', dueDate:'2026-05-10' },
    { id:'t2', title:'Set up CI/CD pipeline', description:'Configure GitHub Actions', priority:'urgent', status:'in-progress', assignee:'Bob', dueDate:'2026-05-05' },
    { id:'t3', title:'Write API documentation', description:'Document all REST endpoints', priority:'medium', status:'review', assignee:'Demo User', dueDate:'2026-05-08' },
    { id:'t4', title:'Deploy to Cloud Run', description:'Push Docker image and deploy', priority:'high', status:'done', assignee:'Alice', dueDate:'2026-05-03' },
    { id:'t5', title:'User testing session', description:'Collect feedback from 5 users', priority:'medium', status:'todo', assignee:'Carol', dueDate:'2026-05-12' },
  ];
  state.messages = [
    { id:'m1', content:'Hey team! Kickoff meeting is at 3pm today 🚀', senderName:'Alice', sender:'alice', createdAt: new Date(Date.now()-3600000).toISOString() },
    { id:'m2', content:'CI/CD pipeline is almost done, will PR soon!', senderName:'Bob', sender:'bob', createdAt: new Date(Date.now()-1800000).toISOString() },
    { id:'m3', content:'Great progress everyone. Keep it up 💪', senderName:'Demo User', sender:'demo-user', createdAt: new Date().toISOString() },
  ];
  state.members = [
    { uid:'alice', name:'Alice Chen', email:'alice@team.com', role:'Lead', status:'online' },
    { uid:'bob', name:'Bob Kumar', email:'bob@team.com', role:'Developer', status:'online' },
    { uid:'carol', name:'Carol Smith', email:'carol@team.com', role:'Designer', status:'away' },
    { uid:'demo-user', name:'Demo User', email:'demo@teamcollab.app', role:'Member', status:'online' },
  ];
  enterApp();
}

// ── App Entry ─────────────────────────────────────────────────────────────────
function showAuthScreen() {
  $('auth-screen').classList.remove('hidden');
  $('app').classList.add('hidden');
}

function enterApp() {
  $('auth-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-name').textContent = state.user.name || 'User';
  $('user-avatar').src = state.user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=7c4dff&color=fff`;
  $('user-avatar').alt = state.user.name;
  switchView('dashboard');
  addActivity(`${state.user.name} joined the workspace`, 'user');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function updateDashboard() {
  const counts = { todo:0, 'in-progress':0, review:0, done:0 };
  state.tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const total = state.tasks.length;
  $('stat-total').textContent = total;
  $('stat-inprogress').textContent = counts['in-progress'];
  $('stat-done').textContent = counts.done;
  $('stat-members').textContent = state.members.length || 4;
  const pct = n => total ? Math.round((n/total)*100)+'%' : '0%';
  $('prog-todo').style.width = pct(counts.todo);
  $('prog-inprogress').style.width = pct(counts['in-progress']);
  $('prog-review').style.width = pct(counts.review);
  $('prog-done').style.width = pct(counts.done);
  $('cnt-todo').textContent = counts.todo;
  $('cnt-inprogress').textContent = counts['in-progress'];
  $('cnt-review').textContent = counts.review;
  $('cnt-done').textContent = counts.done;
  // ARIA
  ['todo','inprogress','review','done'].forEach(k => {
    const fill = $(`prog-${k}`);
    if (fill) fill.parentElement.setAttribute('aria-valuenow', parseInt(fill.style.width) || 0);
  });
}

const activityLog = [];
function addActivity(text, icon = 'bolt') {
  activityLog.unshift({ text, icon, time: new Date().toLocaleTimeString() });
  const feed = $('activity-feed');
  feed.innerHTML = activityLog.slice(0,8).map(a =>
    `<li class="activity-item"><i class="fa-solid fa-${a.icon}" aria-hidden="true"></i><span>${a.text} <small style="color:var(--muted)">${a.time}</small></span></li>`
  ).join('');
}

// ── Kanban ────────────────────────────────────────────────────────────────────
function renderKanban() {
  const cols = { 'todo':[], 'in-progress':[], 'review':[], 'done':[] };
  state.tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });
  Object.entries(cols).forEach(([status, tasks]) => {
    const key = status === 'in-progress' ? 'inprogress' : status;
    const container = $(`col-${key}`);
    const count = $(`col-count-${key}`);
    if (!container) return;
    count.textContent = tasks.length;
    container.innerHTML = tasks.length ? tasks.map(taskCard).join('') :
      '<div class="no-tasks" aria-label="No tasks in this column">No tasks here</div>';
  });
  setupDragAndDrop();
  updateDashboard();
}

/** Sets up HTML5 drag-and-drop across all Kanban columns. */
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card');
  const dropZones = document.querySelectorAll('.kanban-cards');
  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.id;
      card.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '';
      draggedId = null;
    });
  });

  dropZones.forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.style.background = '#f0f4ff';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.background = '';
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.background = '';
      if (!draggedId) return;
      const colKey = zone.id.replace('col-', '');
      const statusMap = { todo:'todo', inprogress:'in-progress', review:'review', done:'done' };
      const newStatus = statusMap[colKey];
      if (!newStatus) return;
      const task = state.tasks.find(t => t.id === draggedId);
      if (task && task.status !== newStatus) {
        task.status = newStatus;
        addActivity(`Task "${task.title}" moved to ${newStatus}`, 'arrows-left-right');
        showToast(`Moved to "${newStatus}"`, 'success');
        renderKanban();
      }
    });
  });
}


function taskCard(task) {
  const priorityIcon = { low:'🟢', medium:'🟡', high:'🟠', urgent:'🔴' }[task.priority] || '🟡';
  const due = task.dueDate ? `<span class="task-assignee"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${task.dueDate}</span>` : '';
  return `<article class="task-card" draggable="true" data-id="${task.id}" tabindex="0" aria-label="Task: ${task.title}, Priority: ${task.priority}">
    <div class="task-card-title">${escHtml(task.title)}</div>
    ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ''}
    <div class="task-card-meta">
      <span class="priority-badge priority-${task.priority}">${priorityIcon} ${cap(task.priority)}</span>
      ${due}
    </div>
    ${task.assignee ? `<div style="font-size:.78rem;color:var(--muted);margin-top:.4rem">👤 ${escHtml(task.assignee)}</div>` : ''}
    <div class="task-actions">
      <button class="task-btn move-btn" onclick="moveTask('${task.id}')" aria-label="Move task ${escHtml(task.title)}">→ Move</button>
      <button class="task-btn" onclick="deleteTask('${task.id}')" aria-label="Delete task ${escHtml(task.title)}">✕ Delete</button>
    </div>
  </article>`;
}

function moveTask(id) {
  const order = ['todo','in-progress','review','done'];
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const idx = order.indexOf(task.status);
  task.status = order[(idx + 1) % order.length];
  addActivity(`Task "${task.title}" moved to ${task.status}`, 'arrows-left-right');
  renderKanban();
  showToast(`Moved to "${task.status}"`, 'success');
}

function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (task) addActivity(`Task "${task.title}" deleted`, 'trash');
  renderKanban();
  showToast('Task deleted', 'info');
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function renderMessages() {
  const container = $('chat-messages');
  if (!state.messages.length) { container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:2rem">No messages yet. Say hello! 👋</p>'; return; }
  container.innerHTML = state.messages.map(m => {
    const own = m.sender === state.user.uid;
    const initials = (m.senderName || 'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const time = m.createdAt ? new Date(m.createdAt?.toDate?.() || m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="chat-msg ${own ? 'own' : ''}" role="article" aria-label="Message from ${escHtml(m.senderName || 'User')}">
      <div class="msg-avatar" aria-hidden="true">${initials}</div>
      <div class="msg-body">
        ${!own ? `<div class="msg-name">${escHtml(m.senderName || 'User')}</div>` : ''}
        <div class="msg-bubble">${escHtml(m.content)}</div>
        <div class="msg-time" aria-label="Sent at ${time}">${time}</div>
      </div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendMessage(content) {
  if (!content.trim()) return;
  const msg = { id: Date.now().toString(), content: content.trim(), sender: state.user.uid, senderName: state.user.name, createdAt: new Date().toISOString() };
  if (window._firestoreAddMessage) {
    try { await window._firestoreAddMessage(content.trim()); } catch (e) { state.messages.push(msg); renderMessages(); }
  } else {
    state.messages.push(msg);
    renderMessages();
  }
  addActivity(`${state.user.name} sent a message`, 'comment');
}

function updateMsgBadge() {
  const badge = $('msg-badge');
  if (state.unreadCount > 0) { badge.textContent = state.unreadCount; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

// ── AI Assistant ──────────────────────────────────────────────────────────────
async function askAI(prompt) {
  appendAIMsg(prompt, true);
  const typing = appendTyping();
  try {
    const res = await fetch('/api/ai/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context: `Team has ${state.tasks.length} tasks and ${state.members.length} members.`, teamId: 'general' })
    });
    typing.remove();
    if (!res.ok) throw new Error('API error');
    const { data } = await res.json();
    appendAIMsg(data.response, false);
  } catch {
    typing.remove();
    appendAIMsg("I'm having trouble connecting right now. Please check that the server is running with a valid GEMINI_API_KEY.", false);
  }
}

function appendAIMsg(text, isUser) {
  const container = $('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-msg${isUser ? ' user-msg' : ''}`;
  div.setAttribute('role', 'article');
  div.setAttribute('aria-label', isUser ? 'Your message' : 'TeamBot response');
  const initials = isUser ? (state.user.name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '🤖';
  div.innerHTML = `<div class="msg-avatar" aria-hidden="true">${initials}</div><div class="ai-bubble">${isUser ? escHtml(text) : markdownToHtml(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTyping() {
  const container = $('ai-messages');
  const div = document.createElement('div');
  div.className = 'ai-msg';
  div.setAttribute('aria-label', 'TeamBot is typing');
  div.innerHTML = `<div class="msg-avatar" aria-hidden="true">🤖</div><div class="typing-indicator"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function summarizeChat() {
  if (!state.messages.length) { showToast('No messages to summarize', 'info'); return; }
  showToast('Generating summary…', 'info');
  try {
    const res = await fetch('/api/ai/summarize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages, teamName: 'General' })
    });
    if (!res.ok) throw new Error();
    const { data } = await res.json();
    switchView('ai');
    appendAIMsg('Here\'s a summary of your team chat:\n\n' + data.summary, false);
    showToast('Summary ready!', 'success');
  } catch { showToast('Could not summarize. Check server config.', 'error'); }
}

// ── Team ──────────────────────────────────────────────────────────────────────
function renderTeam() {
  const members = state.members.length ? state.members : [
    { uid:'u1', name: state.user.name, email: state.user.email, role:'Admin', status:'online' }
  ];
  $('team-grid').innerHTML = members.map(m => {
    const initials = m.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const statusClass = { online:'status-online', away:'status-away', busy:'status-away', offline:'status-offline' }[m.status] || 'status-offline';
    const statusIcon = { online:'🟢', away:'🟡', busy:'🟠', offline:'⚫' }[m.status] || '⚫';
    return `<article class="team-card glass" role="listitem" aria-label="Team member ${escHtml(m.name)}">
      <div class="member-avatar" aria-hidden="true">${initials}</div>
      <div class="member-name">${escHtml(m.name)}</div>
      <div class="member-email">${escHtml(m.email||'')}</div>
      <span class="member-role">${escHtml(m.role||'Member')}</span>
      <div class="member-status ${statusClass}">${statusIcon} ${cap(m.status||'offline')}</div>
    </article>`;
  }).join('');
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function openTaskModal() {
  $('task-modal').classList.remove('hidden');
  $('task-title').focus();
  document.body.style.overflow = 'hidden';
}
function closeTaskModal() {
  $('task-modal').classList.add('hidden');
  $('task-form').reset();
  $('title-error').classList.add('hidden');
  document.body.style.overflow = '';
}

$('task-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('task-title').value.trim();
  if (!title) { $('title-error').classList.remove('hidden'); $('task-title').focus(); return; }
  $('title-error').classList.add('hidden');
  const task = {
    id: Date.now().toString(),
    title,
    description: $('task-desc').value.trim(),
    priority: $('task-priority').value,
    status: $('task-status').value,
    assignee: $('task-assignee').value.trim(),
    dueDate: $('task-due').value,
  };
  state.tasks.push(task);
  addActivity(`New task: "${task.title}" created`, 'plus');
  closeTaskModal();
  renderKanban();
  switchView('kanban');
  showToast('Task created!', 'success');
});

// ── Event Listeners ───────────────────────────────────────────────────────────
document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

$('add-task-btn').addEventListener('click', openTaskModal);
$('kanban-add-btn').addEventListener('click', openTaskModal);
$('modal-close').addEventListener('click', closeTaskModal);
$('cancel-task').addEventListener('click', closeTaskModal);
$('task-modal').addEventListener('click', e => { if (e.target === $('task-modal')) closeTaskModal(); });

$('chat-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('chat-input');
  await sendMessage(input.value);
  input.value = '';
  if (state.currentView === 'chat') renderMessages();
});

$('ai-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('ai-input');
  const prompt = input.value.trim();
  if (!prompt) return;
  input.value = '';
  await askAI(prompt);
});

document.querySelectorAll('.suggestion-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    $('ai-input').value = btn.dataset.prompt;
    $('ai-form').dispatchEvent(new Event('submit'));
  });
});

$('summarize-btn').addEventListener('click', summarizeChat);
$('signout-btn').addEventListener('click', async () => {
  if (window._firebaseSignOut) await window._firebaseSignOut();
  state.user = null; state.demoMode = false;
  showAuthScreen();
});
$('demo-btn').addEventListener('click', startDemoMode);
$('sidebar-toggle').addEventListener('click', () => {
  const sidebar = qs('.sidebar');
  const expanded = sidebar.classList.toggle('open');
  $('sidebar-toggle').setAttribute('aria-expanded', expanded);
});

$('invite-btn').addEventListener('click', () => {
  showToast('Invite link copied to clipboard! (demo)', 'success');
});

// Keyboard: close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTaskModal();
});

// ── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function markdownToHtml(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/^• (.+)$/gm,'<li>$1</li>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>')
    .replace(/\n/g,'<br>');
}

// ── Init ─────────────────────────────────────────────────────────────────────
initFirebase();
