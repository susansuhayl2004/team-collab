# TeamCollab 🚀

> AI-powered team coordination platform that simplifies workflows and improves task visibility — built for the Google PromptWars Warm-Up Challenge.

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-orange)](https://firebase.google.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini%20AI-blue)](https://ai.google.dev)
[![Cloud Run](https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4)](https://cloud.google.com/run)

---

## 🎯 Chosen Vertical

**Team Collaboration Tool** — A smart platform that improves team coordination and communication while simplifying workflow visibility and task management.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📋 **Kanban Board** | Drag-and-drop task management with 4 columns: Todo → In Progress → Review → Done |
| 💬 **Real-time Chat** | Firebase Firestore-powered team messaging |
| 🤖 **AI Assistant (TeamBot)** | Google Gemini-powered assistant for task planning, summaries & productivity tips |
| 🔐 **Google Auth** | One-click sign-in via Firebase Authentication |
| 📊 **Dashboard** | Live task progress charts and team activity feed |
| 👥 **Team Management** | Member profiles with online status indicators |
| 🔍 **Chat Summarizer** | AI-powered conversation summary with one click |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│           Frontend (SPA)            │
│  HTML + CSS + Vanilla JS            │
│  Firebase SDK (Auth + Firestore)    │
└────────────────┬────────────────────┘
                 │ REST API
┌────────────────▼────────────────────┐
│        Express.js Backend           │
│  /api/teams  /api/tasks             │
│  /api/messages  /api/users          │
│  /api/ai  ← Gemini API proxy        │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│         Google Services             │
│  Firebase Auth + Firestore          │
│  Google Gemini 2.0 Flash            │
│  Google Cloud Run (hosting)         │
└─────────────────────────────────────┘
```

---

## 🔧 Approach & Logic

### Smart Assistant (TeamBot)
TeamBot uses **Google Gemini 2.0 Flash** with a custom system prompt tuned for team collaboration. It understands team context (task count, member count) and helps with:
- Sprint planning and task prioritization
- Conversation summarization (pulls last 30 messages)
- Writing standups, retrospectives, and project docs
- Productivity coaching and communication tips

### Task Visibility
The Kanban board provides instant visual workflow clarity. Each card shows priority, assignee, and due date. The dashboard renders real-time progress bars across all status columns.

### Real-time Communication
Firebase Firestore `onSnapshot` listeners push chat messages to all connected clients instantly — no polling needed.

### Security
- **Helmet.js** sets 14+ HTTP security headers
- **Rate limiting** (200 req/15min globally, 60 req/min on API)
- **CORS** restricted to allowed origins
- Input validation and sanitization on all endpoints
- Non-root Docker user

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker (for Cloud Run)
- Google Cloud SDK
- Firebase project
- Gemini API key

### Local Development

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/team-collab.git
cd team-collab

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run tests
npm test

# Start server
npm start
# Open http://localhost:8080
```

### Deploy to Google Cloud Run

```bash
# 1. Build and push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/teamcollab

# 2. Deploy to Cloud Run
gcloud run deploy teamcollab \
  --image gcr.io/YOUR_PROJECT_ID/teamcollab \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,NODE_ENV=production

# 3. Get your service URL
gcloud run services describe teamcollab --format='value(status.url)'
```

---

## 🧪 Testing

```bash
npm test              # Run all tests with coverage
npm run test:ci       # CI mode
```

**Coverage**: 30+ test cases across all API endpoints covering:
- CRUD operations for teams, tasks, messages, users
- Input validation and error handling
- Security headers
- Edge cases (duplicates, invalid data, missing fields)

---

## 🌐 Google Services Used

| Service | Usage |
|---|---|
| **Firebase Authentication** | Google Sign-In for secure user identity |
| **Firebase Firestore** | Real-time NoSQL database for chat messages |
| **Google Gemini 2.0 Flash** | AI assistant powering TeamBot and chat summarization |
| **Google Cloud Run** | Serverless container hosting (Docker-based) |
| **Google Fonts** | Inter typeface for clean typography |

---

## 📁 Project Structure

```
team-collab/
├── server.js           # Express app with security middleware
├── routes/
│   ├── teams.js        # Team CRUD API
│   ├── tasks.js        # Task management API
│   ├── messages.js     # Chat messages API
│   ├── users.js        # User profiles API
│   └── ai.js           # Gemini AI proxy (assist + summarize)
├── public/
│   ├── index.html      # SPA shell (accessible, semantic HTML)
│   ├── style.css       # Dark glassmorphism design system
│   └── app.js          # Frontend logic (Firebase + AI + Kanban)
├── tests/
│   └── api.test.js     # Jest integration tests
├── Dockerfile          # Cloud Run container
├── .env.example        # Environment variable template
└── README.md
```

---

## 💡 Assumptions

1. **Single workspace** — All users collaborate in one shared space (no multi-tenant isolation)
2. **Demo mode** — The app works fully without Firebase config for evaluation purposes
3. **In-memory fallback** — Backend stores data in-memory (no persistent DB required for demo); swap to Firestore Admin SDK for production
4. **Gemini as backend proxy** — API key is kept server-side for security (not exposed to frontend)
5. **Single branch** — All work on `main` per competition rules

---

## ♿ Accessibility

- Semantic HTML5 with ARIA roles, labels, and `aria-live` regions
- Skip-to-content link for keyboard navigation
- `aria-current`, `aria-expanded`, `aria-haspopup` on interactive elements
- Focus-visible outlines for keyboard users
- Screen reader-friendly status announcements
- Color contrast ratios meet WCAG 2.1 AA

---

*Built with ❤️ using Google Gemini, Firebase, and Cloud Run*
