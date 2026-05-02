'use strict';

const express = require('express');
const router = express.Router();

/**
 * POST /api/ai/assist
 * Calls Gemini API to provide AI-powered team collaboration assistance
 */
router.post('/assist', async (req, res) => {
  const { prompt, context, teamId } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }
  if (prompt.trim().length > 2000) {
    return res.status(400).json({ success: false, error: 'Prompt must be 2000 characters or less' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: 'AI service not configured' });
  }

  try {
    const systemContext = `You are TeamBot, an intelligent AI assistant embedded in a team collaboration platform called TeamCollab. 
Your role is to help teams work more effectively by:
- Summarizing conversations and meeting notes
- Suggesting task priorities and assignments
- Answering questions about team projects
- Providing productivity tips
- Helping write project documentation

Team Context: ${context || 'General team workspace'}
Team ID: ${teamId || 'N/A'}

Always be concise, professional, and actionable. Format responses with bullet points when listing items.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemContext}\n\nUser request: ${prompt.trim()}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errData);
      return res.status(502).json({ success: false, error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    res.json({
      success: true,
      data: {
        response: text,
        model: 'gemini-2.0-flash',
        teamId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('AI assist error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get AI response' });
  }
});

/**
 * POST /api/ai/summarize
 * Summarize a list of messages using Gemini
 */
router.post('/summarize', async (req, res) => {
  const { messages, teamName } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: 'Messages array is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: 'AI service not configured' });
  }

  const conversation = messages
    .slice(-30) // limit to last 30 messages
    .map(m => `${m.senderName || 'User'}: ${m.content}`)
    .join('\n');

  const prompt = `Summarize the following team conversation from ${teamName || 'the team'} in 3-5 bullet points. Focus on key decisions, action items, and important information:\n\n${conversation}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      }
    );

    if (!response.ok) throw new Error('Gemini API failed');
    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate summary.';

    res.json({ success: true, data: { summary, messageCount: messages.length, timestamp: new Date().toISOString() } });
  } catch (err) {
    console.error('Summarize error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate summary' });
  }
});

module.exports = router;
