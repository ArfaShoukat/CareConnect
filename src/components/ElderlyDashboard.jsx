import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config'
import { SirenIcon, HeartIcon, PillIcon, ClockIcon, CheckIcon, CopyIcon, MicIcon } from './Icons'
import { checkSafeZone, formatDistance } from '../utils/geoUtils'

// ── Circular Adherence Ring (shared utility component) ────────────────────────
// Duplicated here so ElderlyDashboard has no cross-file dependency on Family.
// If you extract it to a shared file later, remove this copy.
function AdherenceRing({ pct, size = 52, stroke = 5 }) {
  const r      = (size - stroke) / 2
  const circum = 2 * Math.PI * r
  const offset = circum * (1 - pct / 100)
  const color  = pct === 100 ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={stroke} className="text-slate-100" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circum}
          initial={{ strokeDashoffset: circum }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black leading-none" style={{ color }}>{pct}%</span>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Medication alarm — time parsing & TTS ─────────────────────────────────────

/**
 * Converts a clock string like "7:30 AM", "09:00 PM", "14:30" into
 * a zero-padded "HH:MM" 24-hour string for reliable comparison.
 * Returns null if the string can't be parsed.
 */
function parseMedTime(clockStr) {
  if (!clockStr) return null
  const s = clockStr.trim().toUpperCase()

  // Try 12-hour format: "7:30 AM", "12:00 PM", "9 PM"
  const match12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2] ?? '0', 10)
    const period = match12[3]
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Try 24-hour format: "14:30", "07:00"
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const h = parseInt(match24[1], 10)
    const m = parseInt(match24[2], 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  return null
}

/** Returns the current local time as "HH:MM" */
function currentHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Speaks a medicine reminder using the Web Speech API.
 * Optimised for elderly listeners: slow rate, high volume, clear pause.
 * Returns the SpeechSynthesisUtterance so the caller can cancel it.
 */
function speakMedReminder(medName, clockStr) {
  const synth = window.speechSynthesis
  if (!synth) return null

  synth.cancel() // clear any queued speech first

  const text =
    `Assalam-o-Alaikum! ` +
    `It is ${clockStr}. ` +
    `It is time to take your medicine, ${medName}. ` +
    `Please take your medicine now.`

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate   = 0.78   // slower — easier for elderly ears
  utterance.pitch  = 1.05
  utterance.volume = 1.0

  // Repeat twice with a short pause between
  utterance.onend = () => {
    setTimeout(() => {
      const repeat = new SpeechSynthesisUtterance(text)
      repeat.rate   = 0.78
      repeat.pitch  = 1.05
      repeat.volume = 1.0
      synth.speak(repeat)
    }, 1200)
  }

  synth.speak(utterance)
  return utterance
}

// ── Medication Alarm Overlay ──────────────────────────────────────────────────

function MedicationAlarmOverlay({ med, onMarkTaken, onDismiss, lang = 'en' }) {
  const isUrdu = lang === 'ur'

  return (
    <motion.div
      key="med-alarm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 10, 40, 0.88)', backdropFilter: 'blur(12px)' }}
      aria-modal="true"
      role="alertdialog"
      aria-label="Medication reminder"
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.18) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0.88, y: 32, opacity: 0 }}
        animate={{ scale: 1,    y: 0,  opacity: 1 }}
        exit={{    scale: 0.92, y: 16, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 rounded-[2rem] border border-violet-400/30 shadow-2xl overflow-hidden flex flex-col items-center gap-6 px-8 py-10"
      >
        {/* Shimmer top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" aria-hidden="true" />

        {/* Pulsing pill icon */}
        <motion.div
          animate={{ scale: [1, 1.14, 1], boxShadow: ['0 0 0px rgba(167,139,250,0)', '0 0 40px rgba(167,139,250,0.55)', '0 0 0px rgba(167,139,250,0)'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-24 h-24 rounded-[2rem] bg-violet-600/25 border-2 border-violet-400/50 flex items-center justify-center"
        >
          <span className="text-5xl" aria-hidden="true">💊</span>
        </motion.div>

        {/* Time */}
        <div className="text-center" dir={isUrdu ? 'rtl' : 'ltr'}>
          <p className="text-violet-300 text-sm font-bold uppercase tracking-widest mb-1">
            {isUrdu ? 'دوائی کا وقت' : 'Medicine Time'}
          </p>
          <p className="text-white text-5xl font-black tracking-tight">
            {med.clock}
          </p>
          <p className="text-violet-200/70 text-sm mt-1">
            {isUrdu ? med.time : med.time}
          </p>
        </div>

        {/* Medicine name */}
        <div
          className="w-full bg-white/8 border border-white/12 rounded-2xl px-5 py-4 text-center"
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          <p className="text-white/55 text-xs font-bold uppercase tracking-widest mb-1">
            {isUrdu ? 'دوائی' : 'Medicine'}
          </p>
          <p className="text-white text-2xl font-black leading-tight">{med.name}</p>
          {med.dose && (
            <p className="text-violet-300 text-base font-semibold mt-1">{med.dose}</p>
          )}
        </div>

        {/* Mark as Taken — primary action */}
        <motion.button
          onClick={onMarkTaken}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-5 rounded-2xl font-black text-lg text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-xl shadow-emerald-900/40 transition-colors"
        >
          {isUrdu ? '✓ دوائی لی گئی' : '✓ Mark as Taken'}
        </motion.button>

        {/* Snooze / dismiss */}
        <button
          onClick={onDismiss}
          className="text-white/35 text-sm font-semibold hover:text-white/60 transition-colors"
        >
          {isUrdu ? 'بعد میں یاد دلائیں' : 'Remind me later'}
        </button>

        {/* Bottom shimmer */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" aria-hidden="true" />
      </motion.div>
    </motion.div>
  )
}

// ── Agentic AI voice call — fires against the local Express backend ───────────
// The backend (server/index.js) holds all Twilio + Groq credentials securely.
// This function is intentionally fire-and-forget: a failure never blocks the
// Firestore emergency write, so the panic button always works even offline.
async function triggerAiVoiceAgentCall(elderName, familyPhone) {
  if (!familyPhone) {
    console.warn('triggerAiVoiceAgentCall: no familyPhone provided — skipping call')
    return
  }
  try {
    const res = await fetch('http://localhost:3001/call-emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elderlyName: elderName, familyPhone }),
    })
    const data = await res.json()
    if (data.success) {
      console.log('📞 AI voice call placed — SID:', data.callSid)
    } else {
      console.warn('📞 Voice call failed:', data.error)
    }
  } catch (err) {
    // Server may not be running in all environments — log but never throw
    console.warn('📞 Voice agent unreachable (is server/index.js running?):', err.message)
  }
}

// ── Groq AI engine ────────────────────────────────────────────────────────────
//
// Calls Groq's OpenAI-compatible REST API (llama-3.3-70b-versatile).
// Uses plain fetch — no SDK needed, works directly in the browser.
//
// Setup: add VITE_GROQ_API_KEY=your_key to .env.local
// Get a free key at https://console.groq.com/keys

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

const SYSTEM_PROMPT = `You are the AI Health Guardian inside CareConnect, a safety app for elderly users.
You are a calm, compassionate health assistant for senior citizens.

━━━ LANGUAGE MIRRORING (most important rule) ━━━
Detect the language of the user's input and respond ENTIRELY in that same language.
- Roman Urdu input (e.g. "meri tabyat theek nahi") → respond fully in Roman Urdu only.
- English input (e.g. "I feel dizzy") → respond fully in English only.
- Urdu script input (e.g. "میرا سر درد ہے") → respond fully in Urdu script only.
Never mix languages. Never translate. Mirror exactly what the user wrote in.

━━━ RESPONSE FORMAT ━━━
Always structure your reply in these two sections, written in the detected language:

🤖 AI Analysis / [equivalent heading in detected language]:
[1–2 warm, empathetic sentences that acknowledge the user's specific complaint in their own words. Make them feel heard.]

💡 Safe Action Steps / [equivalent heading in detected language]:
1. [First safe, practical step — one sentence, simple words an elderly person can follow.]
2. [Second step.]
3. [Third step.]

━━━ EMERGENCY RULE ━━━
If the input describes chest pain, difficulty breathing, collapse, fall, loss of consciousness, severe pain, or bleeding:
- Provide the medical guidance first, clearly and calmly, in the user's language.
- Then append this safety reminder translated into the user's language:
  ⚠️ [Translated: "If things get worse, press the red Emergency Panic Button immediately to alert your family."]

━━━ TONE RULES ━━━
- Always warm, gentle, and reassuring — never clinical or alarming unless truly urgent.
- Use simple, everyday words. No medical jargon.
- Short sentences. Easy to read for elderly eyes.
- Never diagnose. Never recommend prescription medication.
- If input is not health-related, gently guide back to health topics in the same language.`

function detectUrgency(text) {
  if (text.includes('⚠️')) return 'high'
  const mediumTerms = ['rest immediately', 'sit down', 'lie down', 'foran', 'serious']
  if (mediumTerms.some(t => text.toLowerCase().includes(t))) return 'medium'
  return 'low'
}

function pickEmoji(text) {
  const t = text.toLowerCase()
  if (t.includes('breath') || t.includes('saans') || t.includes('sans')) return '🫁'
  if (t.includes('chest') || t.includes('seena') || t.includes('heart')) return '❤️'
  if (t.includes('dizz') || t.includes('chakkar') || t.includes('ghoom')) return '💫'
  if (t.includes('head') || t.includes('sar dard') || t.includes('migraine')) return '🤕'
  if (t.includes('stomach') || t.includes('pet') || t.includes('nausea') || t.includes('ulti')) return '🤢'
  if (t.includes('fall') || t.includes('gir') || t.includes('slip')) return '🩹'
  if (t.includes('anxious') || t.includes('ghabra') || t.includes('stress')) return '🌿'
  if (t.includes('weak') || t.includes('kamzor') || t.includes('tired')) return '😔'
  return '🩺'
}

async function callGroq(userText) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_api_key_here') {
    throw new Error('NO_KEY')
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userText },
      ],
      temperature: 0.7,
      max_tokens: 512,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Groq API error ${res.status}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('Empty response from Groq')

  return { text, urgency: detectUrgency(text), emoji: pickEmoji(text) }
}

// ── AI Health Guardian panel ──────────────────────────────────────────────────

function AiHealthGuardian({ groupRef }) {
  const [input, setInput]           = useState('')
  const [response, setResponse]     = useState(null)   // { text, emoji, urgency } | null
  const [listening, setListening]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const recognitionRef = useRef(null)

  // ── Speech recognition ──────────────────────────────────────────────────
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  function startListening() {
    if (!SR) {
      alert('Voice input is not supported in this browser. Please type your symptoms.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SR()
    recognition.continuous      = false
    recognition.interimResults  = false
    // Accept any language the user speaks
    recognition.lang            = ''

    recognition.onstart  = () => setListening(true)
    recognition.onend    = () => setListening(false)
    recognition.onerror  = () => setListening(false)

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  // ── Submit symptom ──────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    setSubmitting(true)
    setResponse(null)

    let result
    try {
      result = await callGroq(text)
    } catch (err) {
      // Graceful fallback when key is missing or API is unreachable
      const isNoKey = err.message === 'NO_KEY'
      result = {
        text: isNoKey
          ? '🔑 AI Guardian not yet connected.\n\nTo activate: add your free Groq API key to .env.local (VITE_GROQ_API_KEY).\nGet one free at https://console.groq.com/keys'
          : `⚠️ Could not reach AI Guardian right now.\n\nPlease rest comfortably. If you feel unwell, press the Crimson Panic Button to alert your family immediately.\nAgar takleef ho toh Emergency Button dabayein.`,
        urgency: isNoKey ? 'low' : 'medium',
        emoji: isNoKey ? '🔑' : '🩺',
      }
    }

    setResponse(result)
    setInput('')

    // Log the full Gemini-generated advice to Firestore so family sees it live
    try {
      await updateDoc(groupRef, {
        activity_logs: arrayUnion({
          type: 'symptom',
          emoji: result.emoji,
          message: `Symptom: "${text}" — ${result.text.split('\n')[0]}`,
          fullAdvice: result.text,
          urgency: result.urgency,
          time: ts(),
          id: Date.now(),
        }),
      })
    } catch (firestoreErr) {
      console.error('Failed to log symptom:', firestoreErr)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-labelledby="ai-guardian-heading"
      className="relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 shadow-xl shadow-indigo-500/10"
    >
      {/* Top shimmer line */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" aria-hidden="true" />

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_60%)] pointer-events-none" aria-hidden="true" />

      <div className="relative px-5 py-5 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 shrink-0">
            <span className="text-xl leading-none" aria-hidden="true">🤖</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="ai-guardian-heading" className="text-sm font-black text-white leading-tight">
              AI Health Guardian
            </h2>
            <p className="text-[11px] text-indigo-300/70 mt-0.5">
              Type or speak — English, Urdu, Roman Urdu, any language
            </p>
          </div>
        </div>

        {/* Input row */}
        <form onSubmit={handleSubmit} className="flex gap-2 items-stretch">
          {/* Text field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setResponse(null) }}
              placeholder={listening ? 'Listening… speak now' : 'Mujhe chakkar aa raha hai / I feel dizzy…'}
              aria-label="Describe your symptoms"
              className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-medium bg-white/5 text-white placeholder:text-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400/60 transition-all duration-200 ${
                listening
                  ? 'border-red-400/70 bg-red-500/10 placeholder:text-red-300/50'
                  : 'border-indigo-400/25 hover:border-indigo-400/40'
              }`}
            />
            {/* Listening pulse ring */}
            {listening && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5 items-end" aria-hidden="true">
                {[1, 2, 3].map(i => (
                  <span
                    key={i}
                    className="w-0.5 bg-red-400 rounded-full animate-bounce"
                    style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </span>
            )}
          </div>

          {/* Mic button */}
          {SR && (
            <button
              type="button"
              onClick={startListening}
              aria-label={listening ? 'Stop recording' : 'Start voice input'}
              aria-pressed={listening}
              className={`flex items-center justify-center w-13 h-auto aspect-square rounded-2xl border-2 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-indigo-400 active:scale-95 shrink-0 ${
                listening
                  ? 'bg-red-500 border-red-400 text-white animate-pulse shadow-lg shadow-red-500/40'
                  : 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/35 hover:border-indigo-400/60 hover:text-white'
              }`}
              style={{ width: '3.25rem' }}
            >
              <MicIcon size={20} />
            </button>
          )}

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            aria-label="Submit symptoms"
            className="flex items-center justify-center px-4 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">→</span>
            )}
          </button>
        </form>

        {/* AI response */}
        {response && (
          <div
            className={`rounded-2xl border px-4 py-4 flex gap-3 transition-all duration-300 ${
              response.urgency === 'high'
                ? 'border-red-400/30 bg-red-500/10'
                : response.urgency === 'medium'
                ? 'border-amber-400/25 bg-amber-500/8'
                : 'border-indigo-300/20 bg-white/5'
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">{response.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  AI Response
                </p>
                {response.urgency === 'high' && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-red-500/30 text-red-300 border border-red-400/30 px-1.5 py-0.5 rounded-full">
                    HIGH RISK
                  </span>
                )}
              </div>
              {/* Render each paragraph of the Gemini response with section-aware styling */}
              {response.text.split('\n').filter(l => l.trim()).map((line, i) => (
                <p
                  key={i}
                  className={`leading-relaxed ${
                    line.startsWith('🤖')
                      ? 'text-sm font-black text-indigo-300 mt-1'
                      : line.startsWith('💡')
                      ? 'text-sm font-black text-emerald-300 mt-3'
                      : line.startsWith('⚠️')
                      ? 'text-xs font-bold text-red-300 mt-3 border-t border-red-400/20 pt-3'
                      : line.match(/^\d\./)
                      ? 'text-sm text-white/90 mt-1.5 pl-1'
                      : 'text-sm text-white/80 mt-1'
                  }`}
                >
                  {line}
                </p>
              ))}
              <p className="text-[10px] text-indigo-400/50 mt-3 font-medium border-t border-white/5 pt-2">
                ✓ Full AI advice logged to family dashboard
              </p>
            </div>
          </div>
        )}

        {/* Hint */}
        {!response && (
          <p className="text-[11px] text-indigo-300/40 text-center font-medium">
            Describe how you feel — your family will see it instantly
          </p>
        )}
      </div>

      {/* Bottom shimmer line */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" aria-hidden="true" />
    </section>
  )
}

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META = {
  emergency: {
    emoji: '🔴',
    label: 'EMERGENCY TRIGGERED',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-400',
    badge: 'bg-red-100 text-red-800',
  },
  checked_in: {
    emoji: '🟢',
    label: 'Safe / Checked In',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  safe: {
    emoji: '🟢',
    label: 'Safe',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  unknown: {
    emoji: '⚪',
    label: 'No update yet',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-600',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ElderlyDashboard({ groupData, careCode, userProfile }) {
  const [alerting, setAlerting]         = useState(false)
  const [copied, setCopied]             = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  // ── Geo-fence state ───────────────────────────────────────────────────────
  // geoStatus: null | 'acquiring' | 'inside' | 'outside' | 'unavailable'
  const [geoStatus, setGeoStatus]         = useState(null)
  const [geoDistance, setGeoDistance]     = useState(null)
  const breachLoggedRef                   = useRef(false) // prevent duplicate log entries

  // ── Language toggle ───────────────────────────────────────────────────────
  const [lang, setLang] = useState('en')
  const isUrdu = lang === 'ur'

  // ── Medication alarm state ────────────────────────────────────────────────
  // alarmMed: medicine object currently ringing — null means no alarm is active
  const [alarmMed, setAlarmMed]     = useState(null)
  // Tracks <medId>_<HHMM> keys to avoid re-firing the same alarm within a minute
  const firedRef    = useRef(new Set())
  // Tracks medicines the elder snoozed this session (won't re-fire until next minute)
  const snoozedRef  = useRef(new Set())

  const status      = groupData?.status || 'unknown'
  const medicines   = groupData?.medicines || []
  const meta        = STATUS_META[status] || STATUS_META.unknown
  const isEmergency = status === 'emergency'
  const isCheckedIn = status === 'checked_in'
  const groupRef    = doc(db, 'care_groups', careCode)

  // ── Safe zone — read entirely from Firestore, no fallbacks ───────────────
  // Family member sets this via the "Set Current Location as Safe Zone" button.
  // Until configured, geo-fence evaluation is skipped.
  const safeZone = (groupData?.safe_lat && groupData?.safe_lng)
    ? {
        lat:    groupData.safe_lat,
        lng:    groupData.safe_lng,
        radius: groupData.safe_radius_meters ?? 200,
      }
    : null

  // ── Core location processor — called on every GPS tick ───────────────────
  function processLocation(lat, lng) {
    // Broadcast live coordinates to Firestore for family view regardless of
    // whether a safe zone is configured yet
    const update = {
      live_location: {
        lat,
        lng,
        updated_at: new Date().toISOString(),
      },
    }

    // Only evaluate geo-fence if the family has configured a safe zone
    if (safeZone) {
      const { outside, distanceMeters } = checkSafeZone(
        lat, lng, safeZone.lat, safeZone.lng, safeZone.radius
      )
      setGeoDistance(distanceMeters)
      setGeoStatus(outside ? 'outside' : 'inside')

      update.live_location.is_breached     = outside
      update.live_location.distance_meters = distanceMeters

      if (outside && !breachLoggedRef.current) {
        breachLoggedRef.current = true
        // NOTE: We deliberately do NOT write status: 'emergency' here.
        // A geo-fence breach is a passive location alert — it must never
        // auto-trigger the SOS state. Only the elder's explicit button press
        // (handleEmergency) is allowed to set status: 'emergency'.
        updateDoc(groupRef, {
          is_breached: true,
          activity_logs: arrayUnion({
            type:    'geo_breach',
            emoji:   '🚨',
            message: `Safe Zone Breach: ${userProfile?.name || 'Elder'} has wandered outside the designated safe zone! (${formatDistance(distanceMeters)} from home)`,
            time:    ts(),
            id:      Date.now(),
          }),
        }).catch(err => console.error('Geo-breach write failed:', err))
      }

      if (!outside && breachLoggedRef.current) {
        breachLoggedRef.current = false
        updateDoc(groupRef, {
          is_breached: false,
          activity_logs: arrayUnion({
            type:    'geo_return',
            emoji:   '🏠',
            message: `Safe Zone Restored: ${userProfile?.name || 'Elder'} has returned within the safe zone.`,
            time:    ts(),
            id:      Date.now(),
          }),
        }).catch(err => console.error('Geo-return write failed:', err))
      }
    } else {
      setGeoStatus('no_zone')
    }

    updateDoc(groupRef, update)
      .catch(err => console.error('live_location write failed:', err))
  }

  // ── Real GPS watcher ───────────────────────────────────────────────────────
  // Dependency array uses the safe zone coordinates (not the safeZone object)
  // so the watcher only restarts when the zone is actually reconfigured.
  // processLocation is called inside the watcher callback — it safely reads
  // current component state via closure without needing to be in deps.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable')
      return
    }
    setGeoStatus('acquiring')
    breachLoggedRef.current = false  // reset latch when zone changes

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => processLocation(coords.latitude, coords.longitude),
      (err) => {
        console.warn('Geolocation error:', err.message)
        setGeoStatus('unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    )

    // Always clean up — prevents multiple active watchers on re-render
    return () => navigator.geolocation.clearWatch(watchId)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeZone?.lat, safeZone?.lng, safeZone?.radius])

  // ── Firestore write helper ────────────────────────────────────────────────

  // ── Medication alarm scheduler ────────────────────────────────────────────
  // Runs every 30 seconds. Compares current HH:MM against each untaken
  // medicine's parsed clock time. Fires TTS + overlay on first match per
  // medicine per minute. Safe to run frequently — deduplication via firedRef.
  useEffect(() => {
    function checkAlarms() {
      if (!medicines || medicines.length === 0) return
      const now = currentHHMM()

      for (const med of medicines) {
        if (med.taken) continue

        const medTime = parseMedTime(med.clock)
        if (!medTime) continue

        const key = `${med.id}_${medTime}`
        if (firedRef.current.has(key)) continue   // already rang this minute
        if (snoozedRef.current.has(med.id)) continue // snoozed by elder

        if (now === medTime) {
          firedRef.current.add(key)
          setAlarmMed(med)
          speakMedReminder(med.name, med.clock)
          break // one alarm at a time — most urgent (first match) wins
        }
      }

      // Reset fired keys at midnight so alarms work again the next day
      const [h, m] = now.split(':').map(Number)
      if (h === 0 && m === 0) {
        firedRef.current.clear()
        snoozedRef.current.clear()
      }
    }

    checkAlarms() // run immediately on mount / medicines change
    const intervalId = setInterval(checkAlarms, 30_000) // then every 30 s
    return () => clearInterval(intervalId)
  }, [medicines]) // re-register whenever the medicines list updates from Firestore
  async function pushUpdate(newStatus, logEntry) {
    setActionLoading(newStatus)
    try {
      await updateDoc(groupRef, {
        status: newStatus,
        activity_logs: arrayUnion({ ...logEntry, time: ts(), id: Date.now() }),
      })
    } finally {
      setActionLoading(null)
    }
  }

  // ── Emergency ─────────────────────────────────────────────────────────────
  async function handleEmergency() {
    if (isEmergency || actionLoading) return
    setAlerting(true)
    setTimeout(() => setAlerting(false), 1800)

    // 1. Write emergency status to Firestore — this always runs first
    await pushUpdate('emergency', {
      type: 'emergency',
      emoji: '🔴',
      message: 'Emergency Triggered!',
    })

    // 2. Fire AI voice call to family — non-blocking, never affects Firestore write
    //    groupData.familyPhone should be stored on the care_groups doc by the
    //    family member during signup (or added later via profile settings)
    triggerAiVoiceAgentCall(
      userProfile?.name || 'Your elder',
      groupData?.familyPhone ?? groupData?.phone ?? null,
    )
  }

  // ── Check-in ──────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    if (isCheckedIn || actionLoading) return
    await pushUpdate('checked_in', {
      type: 'checkin',
      emoji: '🟢',
      message: 'Elderly checked in as safe',
    })
  }

  // ── Mark medicine taken ───────────────────────────────────────────────────
  async function handleMarkTaken(med) {
    if (med.taken || actionLoading) return
    const updated = medicines.map(m => (m.id === med.id ? { ...m, taken: true } : m))
    setActionLoading(`taken-${med.id}`)
    try {
      await updateDoc(groupRef, {
        medicines: updated,
        activity_logs: arrayUnion({
          type: 'medicine',
          emoji: '💊',
          message: `${med.name}${med.dose ? ' ' + med.dose : ''} marked as taken`,
          time: ts(),
          id: Date.now(),
        }),
      })
    } finally {
      setActionLoading(null)
    }
  }

  // ── Alarm: mark taken from overlay ───────────────────────────────────────
  async function handleAlarmMarkTaken() {
    window.speechSynthesis?.cancel()
    const med = alarmMed
    setAlarmMed(null)
    if (med) await handleMarkTaken(med)
  }

  // ── Alarm: snooze (dismiss without marking taken) ─────────────────────────
  function handleAlarmSnooze() {
    window.speechSynthesis?.cancel()
    if (alarmMed) snoozedRef.current.add(alarmMed.id)
    setAlarmMed(null)
  }

  // ── Copy care code ────────────────────────────────────────────────────────
  function copyCode() {    navigator.clipboard.writeText(careCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 pb-16">

      {/* Full-screen red flash on emergency trigger */}
      <div
        className={`fixed inset-0 bg-red-500 pointer-events-none z-40 transition-opacity duration-300 ${alerting ? 'opacity-20' : 'opacity-0'}`}
        aria-hidden="true"
      />

      {/* ── Medication alarm overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {alarmMed && (
          <MedicationAlarmOverlay
            key={alarmMed.id}
            med={alarmMed}
            lang={lang}
            onMarkTaken={handleAlarmMarkTaken}
            onDismiss={handleAlarmSnooze}
          />
        )}
      </AnimatePresence>

      {/* ── Hero banner — full width ─────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden h-44 sm:h-52 shadow-md mb-6">
        <img
          src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&auto=format&fit=crop&q=80"
          alt="Caring hands"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/75 via-indigo-800/50 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Hello,</p>
          <h1 className="text-white text-3xl sm:text-4xl font-black leading-tight drop-shadow">
            {userProfile?.name || 'Friend'}
          </h1>
          <p className="text-indigo-200 text-sm mt-1">How are you feeling today?</p>
        </div>
      </div>

      {/* ── Responsive grid ──────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >

        {/* ── LEFT column (lg: spans 2) — status + actions ─────────────── */}
        <motion.div
          className="lg:col-span-2 flex flex-col gap-5"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
        >

          {/* Care Code + Status — side by side on md+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Care Code card */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center gap-4 h-full">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1">Your Care Code</p>
                <p className="text-2xl font-black tracking-widest text-indigo-700 font-mono">{careCode}</p>
                <p className="text-xs text-slate-400 mt-1">Share this with family members so they can link to you.</p>
              </div>
              <button
                onClick={copyCode}
                aria-label="Copy Care Code"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-indigo-400 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95 shrink-0"
              >
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Status banner */}
            <div
              className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 transition-all duration-500 h-full ${meta.bg} ${meta.border}`}
              role="status"
              aria-live="polite"
            >
              <span className="text-3xl">{meta.emoji}</span>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Status</p>
                <p className={`text-base font-extrabold ${meta.color}`}>{meta.label}</p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${meta.badge} shrink-0`}>
                {isEmergency ? 'URGENT' : isCheckedIn ? 'TODAY' : 'PENDING'}
              </span>
            </div>
          </div>

          {/* Safe Zone Status */}
          {geoStatus && (
            <motion.div
              className={`rounded-2xl border-2 px-5 py-3.5 transition-colors duration-500 ${
                geoStatus === 'outside'   ? 'bg-red-50 border-red-400' :
                geoStatus === 'inside'    ? 'bg-emerald-50 border-emerald-300' :
                geoStatus === 'no_zone'   ? 'bg-amber-50 border-amber-300' :
                                            'bg-slate-50 border-slate-200'
              }`}
              role="status"
              aria-live="polite"
              animate={geoStatus === 'outside' ? {
                boxShadow: [
                  '0 0 0px 0px rgba(239,68,68,0)',
                  '0 0 24px 6px rgba(239,68,68,0.45)',
                  '0 0 0px 0px rgba(239,68,68,0)',
                ],
              } : { boxShadow: 'none' }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {geoStatus === 'outside'   ? '🚨' :
                   geoStatus === 'inside'    ? '🏠' :
                   geoStatus === 'no_zone'   ? '⚙️' :
                   geoStatus === 'acquiring' ? '📡' : '📵'}
                </span>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Safe Zone</p>
                  <p className={`text-sm font-extrabold ${
                    geoStatus === 'outside'  ? 'text-red-700' :
                    geoStatus === 'inside'   ? 'text-emerald-700' :
                    geoStatus === 'no_zone'  ? 'text-amber-700' : 'text-slate-500'
                  }`}>
                    {geoStatus === 'outside'   ? `Breach! — ${formatDistance(geoDistance)} from home` :
                     geoStatus === 'inside'    ? `Inside Safe Zone · ${geoDistance != null ? formatDistance(geoDistance) + ' from centre' : ''}` :
                     geoStatus === 'no_zone'   ? 'Safe zone not set — ask your family to configure it' :
                     geoStatus === 'acquiring' ? 'Acquiring GPS signal…' : 'Location unavailable'}
                  </p>
                </div>
                {geoStatus === 'outside' && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-800 animate-pulse shrink-0">
                    ALERT
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Emergency Panic Button */}
          <div
            className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
              alerting ? 'ring-4 ring-red-400 ring-offset-2 scale-[1.01]' : ''
            }`}
          >
            <div
              className={`absolute inset-0 rounded-3xl bg-red-600/10 ${!isEmergency ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            <button
              onClick={handleEmergency}
              disabled={isEmergency || actionLoading === 'emergency'}
              aria-label="Emergency panic button — press immediately if you need help"
              aria-pressed={isEmergency}
              className={`relative w-full rounded-3xl py-10 px-6 flex flex-col items-center gap-4 transition-all duration-200 focus-visible:outline-4 focus-visible:outline-red-400 shadow-2xl ${
                isEmergency
                  ? 'bg-gradient-to-br from-red-900 to-red-700 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-br from-red-600 via-red-700 to-rose-800 hover:from-red-500 hover:to-rose-700 active:scale-95 hover:shadow-red-400/50'
              }`}
            >
              {actionLoading === 'emergency' ? (
                <span className="w-12 h-12 border-4 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <div
                  className={`p-4 rounded-full bg-white/10 border-2 border-white/25 text-white ${!isEmergency ? 'animate-pulse' : ''}`}
                  aria-hidden="true"
                >
                  <SirenIcon size={40} />
                </div>
              )}
              <div className="text-center">
                <p className="text-white text-3xl sm:text-4xl font-black tracking-wide drop-shadow-lg">
                  EMERGENCY PANIC BUTTON
                </p>
                <p className="text-red-200 text-sm font-medium mt-1.5">
                  {isEmergency ? '🚨 Help has been alerted — stay calm' : 'Press immediately if you need help'}
                </p>
              </div>
            </button>
          </div>

          {/* Check-In Button */}
          <button
            onClick={handleCheckIn}
            disabled={isCheckedIn || actionLoading === 'checked_in'}
            aria-label="Daily check-in — I am feeling fine today"
            aria-pressed={isCheckedIn}
            className={`w-full rounded-3xl py-6 px-6 flex items-center gap-5 transition-all duration-200 shadow-lg focus-visible:outline-4 focus-visible:outline-emerald-400 ${
              isCheckedIn
                ? 'bg-gradient-to-br from-emerald-700 to-emerald-600 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 hover:from-emerald-400 hover:to-teal-600 active:scale-95 hover:shadow-emerald-400/40 hover:shadow-xl hover:scale-[1.01]'
            }`}
          >
            <div className="p-3 rounded-full bg-white/15 border border-white/20 text-white shrink-0">
              {actionLoading === 'checked_in' ? (
                <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin block" aria-hidden="true" />
              ) : (
                <HeartIcon size={24} />
              )}
            </div>
            <div className="text-left flex-1">
              <p className="text-white font-black text-xl leading-tight">
                {isCheckedIn ? 'Checked In for Today ✓' : 'I Am Feeling Fine Today'}
              </p>
              <p className="text-emerald-100 text-xs font-medium mt-0.5">
                {isCheckedIn ? 'Your family has been notified' : 'Tap to send your daily check-in to your family'}
              </p>
            </div>
          </button>

          {/* Medicine Reminders */}
          <section aria-labelledby="med-heading" className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
              <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><PillIcon /></span>
              <h2 id="med-heading" className="text-base font-black text-slate-800">Today's Medicines</h2>
              {/* Live adherence ring */}
              {medicines.length > 0 && (
                <div className="ml-1">
                  <AdherenceRing
                    pct={Math.round((medicines.filter(m => m.taken).length / medicines.length) * 100)}
                    size={44}
                    stroke={4}
                  />
                </div>
              )}
              <span className="ml-auto text-xs font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full">
                {medicines.filter(m => !m.taken).length} pending
              </span>
            </div>
            <ul className="divide-y divide-slate-50" aria-label="Medicine list">
              {medicines.length === 0 && (
                <li className="px-5 py-8 text-center text-slate-400 text-sm">
                  No medicines scheduled yet.<br />Ask a family member to add some.
                </li>
              )}
              {[...medicines]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(med => (
                  <li
                    key={med.id}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-all duration-200 hover:bg-slate-50/80 ${med.taken ? 'opacity-55' : ''}`}
                  >
                    <div className={`p-2 rounded-xl ${med.taken ? 'bg-emerald-50 text-emerald-500' : 'bg-violet-50 text-violet-500'}`}>
                      <PillIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${med.taken ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {med.name}
                        {med.dose && <span className="ml-1.5 font-normal text-slate-400">{med.dose}</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <ClockIcon />{med.time} · {med.clock}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMarkTaken(med)}
                      disabled={med.taken || !!actionLoading}
                      aria-label={med.taken ? `${med.name} already taken` : `Mark ${med.name} as taken`}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                        med.taken
                          ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white active:scale-95'
                      }`}
                    >
                      {actionLoading === `taken-${med.id}` ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckIcon />
                      )}
                      {med.taken ? 'Done' : 'Taken'}
                    </button>
                  </li>
                ))}
            </ul>
          </section>

        </motion.div>{/* end left column */}

        {/* ── RIGHT column — AI guardian ────────────────────────────────── */}
        <motion.div
          className="lg:col-span-1 flex flex-col gap-5"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 } } }}
        >
          <AiHealthGuardian groupRef={groupRef} />
        </motion.div>

      </motion.div>{/* end grid */}
    </div>
  )
}