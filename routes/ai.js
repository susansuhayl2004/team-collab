'use strict';

/**
 * @fileoverview AI API router — proxies requests to Google Gemini 2.0 Flash.
 *
 * Exposes two endpoints:
 *   - POST /api/ai/assist    — general TeamBot assistant
 *   - POST /api/ai/summarize — Gemini-powered chat summarisation
 *
 * All Gemini calls are made server-side so the API key is never exposed
 * to the browser. Responses include safety settings to block harmful content.
 *
 * @module routes/ai
 */

const express = require('express');
const { validateRequiredString, assertValid } = require('../utils/validate');
const { ServiceUnavailableError } = require('../utils/errors');

const router = express.Router();

/** Gemini REST API base URL. */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Default Gemini model to use. */
const GEMINI_MODEL = 'gemini-2.0-flash';

/** Safety settings applied to every Gemini request. */
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the Gemini API key from the environment or throws 503.
 * @returns {string} The API key
 * @throws {ServiceUnavailableError} If GEMINI_API_KEY is not configured
 */
function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { throw new ServiceUnavailableError('AI service is not configured'); }
  return key;
}

/**
 * Sends a prompt to the Gemini REST API and returns the generated text.
 * @param {string}   apiKey         - Gemini API key
 * @param {string}   promptText     - The full prompt to send
 * @param {object}   [genConfig={}] - Optional generationConfig overrides
 * @returns {Promise<string>}        Generated text from Gemini
 * @throws {Error} On HTTP errors or empty responses
 */
async function callGemini(apiKey, promptText, genConfig = {}) {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
        ...genConfig,
      },
      safetySettings: SAFETY_SETTINGS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('Gemini API error:', response.status, errBody);
    throw new Error(`Gemini returned ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

/**
 * Builds the TeamBot system context string injected before every user prompt.
 * @param {string} [context='General team workspace'] - Current team context
 * @param {string} [teamId='N/A']                    - Team identifier
 * @returns {string} System context prefix
 */
function buildSystemContext(context = 'General team workspace', teamId = 'N/A') {
  return `You are TeamBot, an intelligent AI assistant embedded in TeamCollab.
Your role is to help teams work more effectively by:
- Summarising conversations and meeting notes
- Suggesting task priorities and assignments
- Answering questions about team projects and workflows
- Providing productivity and collaboration tips
- Helping write project documentation

Team Context: ${context}
Team ID: ${teamId}

Always be concise, professional, and actionable. Use bullet points when listing items.`;
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

/**
 * @route POST /api/ai/assist
 * @description Sends a user prompt to Gemini 2.0 Flash and returns TeamBot's
 *   reply. Injects team context into the system prompt for relevant answers.
 *
 * @body {{ prompt: string, context?: string, teamId?: string }}
 * @returns {{ success: boolean, data: { response: string, model: string,
 *             teamId: string, timestamp: string } }}
 *
 * @throws {400} Prompt missing, blank, or exceeds 2000 chars
 * @throws {503} GEMINI_API_KEY not configured
 * @throws {502} Gemini API returned a non-OK response
 * @throws {500} Network or parsing error
 */
router.post('/assist', async (req, res, next) => {
  try {
    const { prompt, context, teamId } = req.body;
    assertValid(validateRequiredString(prompt, 'prompt', 2000));

    const apiKey = getApiKey();
    const fullPrompt = `${buildSystemContext(context, teamId)}\n\nUser request: ${prompt.trim()}`;
    const text = await callGemini(apiKey, fullPrompt, { temperature: 0.7, maxOutputTokens: 1024 });

    res.json({
      success: true,
      data: {
        response: text,
        model: GEMINI_MODEL,
        teamId: teamId || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err.message && err.message.startsWith('Gemini returned')) {
      return res.status(502).json({ success: false, error: 'AI service temporarily unavailable' });
    }
    next(err);
  }
});

/**
 * @route POST /api/ai/summarize
 * @description Summarises an array of chat messages into 3–5 bullet points
 *   using Gemini. Useful for catching up on missed conversations.
 *
 * @body {{ messages: Array<{ senderName?: string, content: string }>, teamName?: string }}
 * @returns {{ success: boolean, data: { summary: string, messageCount: number, timestamp: string } }}
 *
 * @throws {400} Messages array missing or empty
 * @throws {503} GEMINI_API_KEY not configured
 * @throws {500} Gemini or network error
 */
router.post('/summarize', async (req, res, next) => {
  try {
    const { messages, teamName } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages must be a non-empty array' });
    }

    const apiKey = getApiKey();

    // Use last 30 messages to stay within token limits
    const conversation = messages
      .slice(-30)
      .map((m) => `${m.senderName || 'User'}: ${m.content}`)
      .join('\n');

    const prompt = `Summarise the following team conversation from "${teamName || 'the team'}" in 3–5 clear bullet points.
Focus on: key decisions made, action items assigned, and important information shared.

Conversation:
${conversation}`;

    const summary = await callGemini(apiKey, prompt, { temperature: 0.3, maxOutputTokens: 512 });

    res.json({
      success: true,
      data: {
        summary,
        messageCount: messages.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/ai/health
 * @description Checks whether the AI service is configured (key present).
 * @returns {{ success: boolean, configured: boolean, model: string }}
 */
router.get('/health', (req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  res.json({ success: true, configured, model: GEMINI_MODEL });
});

module.exports = router;
