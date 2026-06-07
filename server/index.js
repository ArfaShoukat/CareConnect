/**
 * CareConnect — Agentic AI Voice Call Backend
 *
 * POST /call-emergency
 *   Generates an urgent voice script via Groq (Llama) then places
 *   a real phone call to the family member using Twilio.
 *
 * Stack: Express · Groq SDK · Twilio
 *
 * ── Start ──────────────────────────────────────────────────────────────────
 *   cd server && npm install && node index.js
 *   (or from project root: npm run server)
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import twilio from 'twilio'
import Groq from 'groq-sdk'

// ── Validate required env vars on startup ─────────────────────────────────────

const REQUIRED = [
  'GROQ_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
]

const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) {
  console.error(`\n❌  Missing environment variables: ${missing.join(', ')}`)
  console.error('    Copy server/.env.example to server/.env and fill in the values.\n')
  process.exit(1)
}

// ── Clients ───────────────────────────────────────────────────────────────────

const groq    = new Groq({ apiKey: process.env.GROQ_API_KEY })
const twClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// ── Express app ───────────────────────────────────────────────────────────────

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' })) // Vite dev server
app.use(express.json())

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── POST /call-emergency ──────────────────────────────────────────────────────

app.post('/call-emergency', async (req, res) => {
  const { elderlyName, familyPhone } = req.body

  // ── Input validation ────────────────────────────────────────────────────
  if (!elderlyName || typeof elderlyName !== 'string') {
    return res.status(400).json({ error: 'elderlyName is required' })
  }
  if (!familyPhone || typeof familyPhone !== 'string') {
    return res.status(400).json({ error: 'familyPhone is required' })
  }

  const name  = elderlyName.trim()
  const phone = familyPhone.trim()

  console.log(`\n📞  Emergency call triggered for: ${name} → ${phone}`)

  try {
    // ── Step 1: Generate voice script with Groq / Llama ──────────────────
    console.log('🤖  Generating AI voice script…')

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are an emergency alert voice assistant. ' +
            'Generate EXACTLY 2 sentences. ' +
            'Be urgent but calm. Use plain English only — no special characters, no markdown. ' +
            'The sentences will be spoken aloud via a phone call.',
        },
        {
          role: 'user',
          content:
            `Generate a 2-sentence urgent emergency phone alert. ` +
            `The elderly person's name is "${name}". ` +
            `Tell the family member that ${name} has just pressed their emergency panic button ` +
            `and needs immediate help. Ask them to call or visit ${name} right away.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 120,
    })

    const script = completion.choices[0]?.message?.content?.trim()
    if (!script) throw new Error('Groq returned an empty script')

    console.log(`✅  Script: "${script}"`)

    // ── Step 2: Build TwiML — Twilio reads this when the call connects ───
    const twiml = new twilio.twiml.VoiceResponse()

    twiml.say(
      { voice: 'Polly.Joanna', language: 'en-US' },
      'This is an automated emergency alert from CareConnect.'
    )
    twiml.pause({ length: 1 })
    twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, script)
    twiml.pause({ length: 1 })
    twiml.say(
      { voice: 'Polly.Joanna', language: 'en-US' },
      'This message will now repeat.'
    )
    twiml.pause({ length: 1 })
    twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, script)

    const twimlString = twiml.toString()
    console.log('📋  TwiML ready')

    // ── Step 3: Place the call via Twilio ─────────────────────────────────
    console.log(`📡  Placing call to ${phone}…`)

    const call = await twClient.calls.create({
      to:   phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: twimlString,
    })

    console.log(`✅  Call placed — SID: ${call.sid}`)

    return res.json({
      success: true,
      callSid: call.sid,
      script,
    })

  } catch (err) {
    console.error('❌  /call-emergency error:', err.message)

    // Return a structured error so the frontend can show a useful message
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    })
  }
})

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  CareConnect voice server running on http://localhost:${PORT}`)
  console.log(`    POST http://localhost:${PORT}/call-emergency\n`)
})
