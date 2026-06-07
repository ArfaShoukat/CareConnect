import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config'
import { PillIcon, ClockIcon, ActivityIcon, PlusIcon, TrashIcon, ShieldIcon, PhoneIcon, PencilIcon, HospitalIcon } from './Icons'
import { formatDistance } from '../utils/geoUtils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fullTs() {
  return new Date().toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META = {
  emergency: {
    emoji: '🔴',
    label: 'EMERGENCY TRIGGERED',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-400',
    badge: 'bg-red-100 text-red-700',
  },
  checked_in: {
    emoji: '🟢',
    label: 'Safe / Checked In',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  safe: {
    emoji: '🟢',
    label: 'Safe',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700',
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

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-300 transition-all'

const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5'

// ── Circular Adherence Ring ───────────────────────────────────────────────────
// Pure SVG + Framer Motion. Receives a 0–100 pct and animates strokeDashoffset.

function AdherenceRing({ pct, size = 52, stroke = 5 }) {
  const r      = (size - stroke) / 2
  const circum = 2 * Math.PI * r
  const offset = circum * (1 - pct / 100)

  const color =
    pct === 100 ? '#10b981' :   // emerald
    pct >= 60   ? '#6366f1' :   // indigo
    pct >= 30   ? '#f59e0b' :   // amber
                  '#ef4444'     // red

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      {/* Track */}
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-100"
        />
        {/* Animated fill */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circum}
          initial={{ strokeDashoffset: circum }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      {/* Percentage label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[11px] font-black leading-none"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
    </div>
  )
}

// ── Nearby Emergency Hospitals ────────────────────────────────────────────────
//
// Data source: OpenStreetMap Overpass API (free, no key, real verified data)
// Coordinates: prefers elder's live_location from Firestore; falls back to the
//              family member's own browser geolocation if elder hasn't shared yet.
// AI layer:    Groq adds a one-line triage note per hospital (enhancement only —
//              hospitals display even if Groq is unavailable).

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY

// Get family member's browser location as a fallback
function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'))
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

// Fetch real hospitals from OpenStreetMap — broad query, no emergency=yes filter
// (that tag is missing on most real hospitals in OSM, which caused empty results)
async function fetchHospitalsOSM(lat, lng, radiusKm = 10) {
  const r = radiusKm * 1000
  // Union of: hospitals, clinics with emergency departments, standalone emergency rooms
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="hospital"](around:${r},${lat},${lng});
      way["amenity"="hospital"](around:${r},${lat},${lng});
      relation["amenity"="hospital"](around:${r},${lat},${lng});
      node["amenity"="clinic"](around:${r},${lat},${lng});
      way["amenity"="clinic"](around:${r},${lat},${lng});
      node["healthcare"="hospital"](around:${r},${lat},${lng});
      way["healthcare"="hospital"](around:${r},${lat},${lng});
    );
    out center tags 20;
  `
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body:   'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`Overpass API error ${res.status}`)
  const data = await res.json()
  return data.elements ?? []
}

// Haversine distance in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Format distance for display
function fmtDist(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// Groq: add a triage note to each hospital (fire-and-forget, non-blocking)
async function enrichWithGroq(hospitals) {
  if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here') return hospitals
  const list = hospitals.map((h, i) => `${i + 1}. ${h.name} — ${fmtDist(h.distanceKm)}`).join('\n')
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are an emergency triage assistant. Return ONLY a raw JSON array (no markdown). ' +
              'Each element: { "index": <1-based int>, "note": "<one calm sentence for a worried family member — ' +
              'e.g. whether it has a 24h ER, trauma unit, or general emergency department>" }.',
          },
          { role: 'user', content: `Hospitals:\n${list}` },
        ],
        temperature: 0.3,
        max_tokens:  300,
      }),
    })
    const data  = await res.json()
    const raw   = data?.choices?.[0]?.message?.content?.trim() ?? '[]'
    // Strip potential markdown fences before parsing
    const clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const notes = JSON.parse(clean)
    return hospitals.map((h, i) => ({
      ...h,
      note: notes.find(n => n.index === i + 1)?.note ?? null,
    }))
  } catch {
    return hospitals  // Groq unavailable — hospitals still show without notes
  }
}

// Main: OSM fetch → deduplicate → sort → top 4 → Groq enrich
async function getNearbyHospitals(lat, lng) {
  const elements = await fetchHospitalsOSM(lat, lng, 15)

  // Deduplicate by name (OSM often returns the same hospital as node + way)
  const seen = new Set()
  const hospitals = elements
    .map(el => {
      const hLat = el.lat ?? el.center?.lat
      const hLng = el.lon ?? el.center?.lon
      if (!hLat || !hLng) return null
      const name = (el.tags?.name || el.tags?.['name:en'] || '').trim()
      if (!name) return null
      return {
        id:         el.id,
        name,
        phone:      el.tags?.phone ?? el.tags?.['contact:phone'] ?? null,
        lat:        hLat,
        lng:        hLng,
        distanceKm: haversineKm(lat, lng, hLat, hLng),
        note:       null,
      }
    })
    .filter(item => {
      if (!item) return false
      // Deduplicate by normalised name
      const key = item.name.toLowerCase().replace(/\s+/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 4)

  if (hospitals.length === 0) return []
  return enrichWithGroq(hospitals)
}

// ── NearbyHospitals widget ────────────────────────────────────────────────────

function NearbyHospitals({ liveLocation }) {
  const [hospitals, setHospitals] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [fetched,   setFetched]   = useState(false)
  const [coordSrc,  setCoordSrc]  = useState(null) // 'elder' | 'browser'

  // Prefer elder's GPS from Firestore; fall back to family's browser location
  const elderLat = liveLocation?.lat
  const elderLng = liveLocation?.lng
  const hasElderCoords = !!(elderLat && elderLng)

  async function handleFetch() {
    setLoading(true)
    setError(null)
    setHospitals([])

    let lat, lng

    if (hasElderCoords) {
      // Use the elder's real GPS streamed from ElderlyDashboard
      lat = elderLat
      lng = elderLng
      setCoordSrc('elder')
    } else {
      // Elder hasn't shared location yet — use family member's browser location
      try {
        const pos = await getBrowserLocation()
        lat = pos.lat
        lng = pos.lng
        setCoordSrc('browser')
      } catch {
        setError('Could not get location. Please allow browser location access and try again.')
        setLoading(false)
        return
      }
    }

    try {
      const results = await getNearbyHospitals(lat, lng)
      if (results.length === 0) {
        setError('No hospitals found within 15 km. The area may have limited OSM coverage.')
      } else {
        setHospitals(results)
        setFetched(true)
      }
    } catch (err) {
      setError('Could not reach map services. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="hospitals-heading"
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
        <span className="p-2 rounded-xl bg-red-50 text-red-500 shrink-0">
          <HospitalIcon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="hospitals-heading" className="text-base font-black text-slate-800">
            Nearby Emergency Hospitals
          </h2>
          {fetched && coordSrc && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {coordSrc === 'elder'
                ? '📍 Based on elder\'s live location'
                : '📱 Based on your device location (elder GPS not yet active)'}
            </p>
          )}
        </div>
        {!loading && (
          <button
            onClick={handleFetch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors shadow-sm shadow-red-200 active:scale-95 shrink-0"
          >
            {fetched ? '↻ Refresh' : '🔍 Scan'}
          </button>
        )}
      </div>

      <div className="px-5 py-4">

        {/* Loading — radar animation + skeleton */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2 border-red-400/60"
                  style={{ width: 24 + i * 16, height: 24 + i * 16 }}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.35, ease: 'easeOut' }}
                />
              ))}
              <div className="w-5 h-5 rounded-full bg-red-500 z-10 flex items-center justify-center">
                <span className="text-white text-[9px] font-black">+</span>
              </div>
            </div>
            <p className="text-slate-500 text-xs font-semibold text-center">
              Scanning radius around elder's location…
            </p>
            <div className="w-full flex flex-col gap-2.5 mt-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-3 bg-slate-100 rounded-full w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                  </div>
                  <div className="w-14 h-7 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium text-center my-2">
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && hospitals.length > 0 && (
          <motion.ul
            className="flex flex-col gap-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
          >
            {hospitals.map((h, i) => {
              const origin  = hasElderCoords ? `${elderLat},${elderLng}` : ''
              const mapsUrl = origin
                ? `https://www.google.com/maps/dir/${origin}/${h.lat},${h.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`
              return (
                <motion.li
                  key={h.id}
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show:   { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
                  }}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 hover:border-red-100 hover:bg-red-50/40 transition-colors group"
                >
                  {/* Rank */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                    i === 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {i === 0 ? '🏥' : i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 leading-snug">{h.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className={`font-bold ${i === 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        📍 {fmtDist(h.distanceKm)}
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                          Nearest
                        </span>
                      )}
                      {h.phone && (
                        <a href={`tel:${h.phone}`} className="text-indigo-500 hover:underline font-medium">
                          {h.phone}
                        </a>
                      )}
                    </p>
                    {h.note && (
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{h.note}</p>
                    )}
                  </div>

                  {/* Navigate */}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Navigate to ${h.name}`}
                    className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-white bg-red-500 hover:bg-red-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all active:scale-95"
                  >
                    🗺 Go
                  </a>
                </motion.li>
              )
            })}
          </motion.ul>
        )}

        {/* Initial prompt */}
        {!loading && !fetched && !error && (
          <div className="text-center py-5 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-2xl">🏥</div>
            <p className="text-slate-500 text-sm max-w-[220px] leading-snug">
              Press <strong>Scan</strong> to find the 4 closest hospitals to the elder's current GPS position.
            </p>
            {!hasElderCoords && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-[220px] text-center">
                ⚠️ Elder's GPS not active yet — will use your device location instead.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── AI Health Companion Insight ───────────────────────────────────────────────

function AiInsights({ status, logs, medicines }) {
  const isEmergency = status === 'emergency'

  // ── Medication adherence ──────────────────────────────────────────────────
  const totalMeds  = medicines?.length ?? 0
  const takenMeds  = medicines?.filter(m => m.taken).length ?? 0
  const adherencePct = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 100

  // ── Predictive breakdown logic ────────────────────────────────────────────
  // Count medicine-related log entries where the log message contains "pending"
  // or wasn't marked taken, going back through the last 30 activity_logs.
  // We use a proxy: entries of type 'medicine' that contain "added" (never taken)
  // vs "taken" — if there are more than 3 un-acknowledged medicine add events
  // with no corresponding "taken" log, we flag predictive risk.
  const medAddLogs   = logs.filter(l => l.type === 'medicine' && l.emoji === '➕').length
  const medTakenLogs = logs.filter(l => l.type === 'medicine' && l.emoji === '💊').length
  const missedCount  = Math.max(0, medAddLogs - medTakenLogs)
  const isPredictiveRisk = missedCount > 3 || (totalMeds > 0 && adherencePct < 40)

  const recentEmergencies = logs.filter(l => l.type === 'emergency').length
  const recentCheckins    = logs.filter(l => l.type === 'checkin').length

  // ── Derive card state ─────────────────────────────────────────────────────
  let insight, subtext, accent, dot, badge, badgeClass

  if (isEmergency) {
    insight    = 'CRITICAL: High-stress pattern detected via manual panic response. Immediate intervention advised.'
    subtext    = 'Pattern based on current status and recent activity log analysis.'
    accent     = 'from-red-950/80 via-red-900/70 to-rose-900/80 border-red-500/50 shadow-red-500/20'
    dot        = 'bg-red-400'
    badge      = 'CRITICAL'
    badgeClass = 'bg-red-500/30 border-red-400/40 text-red-300'
  } else if (isPredictiveRisk) {
    insight    = '🚨 Analysis Alert: Noticeable spike in missed medications over the last 72 hours. Predictive analytics indicate an increased risk of cognitive disorientation or physical instability. Recommended action: Immediate caregiver intervention.'
    subtext    = `${missedCount} unacknowledged medication event${missedCount !== 1 ? 's' : ''} detected · Adherence at ${adherencePct}% · Proactive intervention recommended.`
    accent     = 'from-orange-950/80 via-red-900/70 to-rose-950/80 border-orange-500/50 shadow-orange-500/20'
    dot        = 'bg-orange-400'
    badge      = '⚠️ HIGH RISK'
    badgeClass = 'bg-orange-500/30 border-orange-400/40 text-orange-300 animate-pulse'
  } else if (status === 'checked_in' || status === 'safe') {
    if (recentEmergencies > 0) {
      insight    = `Analysis: ${recentEmergencies} emergency event${recentEmergencies > 1 ? 's' : ''} detected in recent history. Monitor closely for recurring stress patterns.`
      subtext    = 'Recommend increasing check-in frequency over the next 24 hours.'
      accent     = 'from-amber-950/70 via-amber-900/60 to-orange-900/70 border-amber-500/40 shadow-amber-500/15'
      dot        = 'bg-amber-400'
      badge      = 'CAUTION'
      badgeClass = 'bg-amber-500/20 border-amber-400/30 text-amber-300'
    } else {
      insight    = 'AI Analysis: Patient status is optimal. All systems steady.'
      subtext    = `${recentCheckins} check-in${recentCheckins !== 1 ? 's' : ''} recorded · No emergency events detected · Medication compliance at ${adherencePct}%.`
      accent     = 'from-emerald-950/70 via-emerald-900/60 to-teal-900/70 border-emerald-500/40 shadow-emerald-500/15'
      dot        = 'bg-emerald-400'
      badge      = 'NOMINAL'
      badgeClass = 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
    }
  } else {
    insight    = 'Awaiting first activity signal. No data to analyse yet.'
    subtext    = 'AI insights will appear once the elderly user interacts with their dashboard.'
    accent     = 'from-slate-800/80 via-slate-800/70 to-slate-900/80 border-slate-600/40 shadow-slate-500/10'
    dot        = 'bg-slate-400'
    badge      = 'IDLE'
    badgeClass = 'bg-slate-500/20 border-slate-400/30 text-slate-400'
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${accent} shadow-lg px-5 py-5 flex flex-col gap-3 transition-all duration-700`}
      aria-label="AI Health Companion Insight"
    >
      {/* Shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true" />

      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 border border-white/15 shrink-0">
          <span className="text-base leading-none" aria-hidden="true">🤖</span>
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${dot} ${isEmergency || isPredictiveRisk ? 'animate-ping' : 'animate-pulse'}`} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">AI Health Companion</p>
          <p className="text-xs font-bold text-white/80 leading-none mt-0.5">Real-time pattern analysis</p>
        </div>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${badgeClass}`}>
          {badge}
        </span>
      </div>

      <div className="h-px bg-white/10" aria-hidden="true" />

      {/* Adherence ring + insight side by side when medicines exist */}
      {totalMeds > 0 ? (
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <AdherenceRing pct={adherencePct} />
            <span className="text-[9px] font-black uppercase tracking-wider text-white/35">Adherence</span>
          </div>
          <p className={`text-sm font-bold leading-relaxed flex-1 ${isEmergency || isPredictiveRisk ? 'text-orange-200' : 'text-white/90'}`}>
            {insight}
          </p>
        </div>
      ) : (
        <p className={`text-sm font-bold leading-relaxed ${isEmergency || isPredictiveRisk ? 'text-orange-200' : 'text-white/90'}`}>
          {insight}
        </p>
      )}

      <p className="text-xs text-white/45 leading-relaxed">{subtext}</p>

      {/* Stats row */}
      {logs.length > 0 && (
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {[
            { label: 'Check-ins',  val: recentCheckins,  color: 'text-emerald-400' },
            { label: 'Alerts',     val: recentEmergencies, color: recentEmergencies > 0 ? 'text-red-400' : 'text-white/40' },
            { label: 'Med events', val: logs.filter(l => l.type === 'medicine').length, color: 'text-violet-400' },
            { label: 'Missed',     val: missedCount, color: missedCount > 0 ? 'text-orange-400' : 'text-white/40' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 min-w-[56px]">
              <span className={`text-base font-black ${color}`}>{val}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/35 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Live Tracker Widget ───────────────────────────────────────────────────────

function LiveTrackerWidget({ liveLocation, elderlyName, safeZone, groupRef }) {
  const [settingZone, setSettingZone] = useState(false)
  const [drawerOpen, setDrawerOpen]   = useState(false)

  // ── Firestore: Set Current Location as Safe Zone ──────────────────────────
  async function handleSetSafeZone() {
    if (!liveLocation?.lat || !liveLocation?.lng) return
    setSettingZone(true)
    try {
      await updateDoc(groupRef, {
        safe_lat:           liveLocation.lat,
        safe_lng:           liveLocation.lng,
        safe_radius_meters: 200,
        is_breached:        false,
        activity_logs: arrayUnion({
          type:    'safe_zone_set',
          emoji:   '🏠',
          message: `Safe Zone configured at (${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}) with a 200 m radius.`,
          time:    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          id:      Date.now(),
        }),
      })
    } catch (err) {
      console.error('Failed to set safe zone:', err)
    } finally {
      setSettingZone(false)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const hasLocation     = !!(liveLocation?.lat && liveLocation?.lng)
  const hasSafeZone     = !!(safeZone?.lat && safeZone?.lng)
  const distance_meters = liveLocation?.distance_meters ?? null
  const is_breached     = liveLocation?.is_breached     ?? false
  const lat             = liveLocation?.lat
  const lng             = liveLocation?.lng
  const radius          = safeZone?.radius ?? 200

  const updatedAt = liveLocation?.updated_at
    ? new Date(liveLocation.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  // Progress bar — caps at 100% once distance reaches 3× the radius
  const pct = (hasSafeZone && distance_meters != null)
    ? Math.min(100, Math.round((distance_meters / (radius * 3)) * 100))
    : 0

  const mapsUrl = hasLocation ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null
  const homeUrl = hasSafeZone ? `https://www.google.com/maps/search/?api=1&query=${safeZone.lat},${safeZone.lng}` : null

  return (
    <motion.section
      aria-labelledby="tracker-heading"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-3xl border-2 shadow-lg transition-colors duration-500 ${
        is_breached
          ? 'border-red-400 bg-gradient-to-br from-red-950/80 via-red-900/70 to-rose-950/80'
          : 'border-emerald-400/50 bg-gradient-to-br from-slate-900 via-emerald-950/60 to-slate-900'
      }`}
    >
      {/* Accent bar */}
      <div
        className={`h-1 ${is_breached
          ? 'bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse'
          : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500'
        }`}
        aria-hidden="true"
      />

      {/* ── Main visible card ───────────────────────────────────────────── */}
      <div className="px-5 py-4 flex flex-col gap-4">

        {/* Header row — name, time, badge, gear */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shrink-0 ${
            is_breached ? 'bg-red-500/20 border-red-400/40' : 'bg-emerald-500/15 border-emerald-400/30'
          }`}>
            <span className="text-base" aria-hidden="true">{is_breached ? '🚨' : '📍'}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="tracker-heading" className="text-sm font-black text-white truncate">
              {elderlyName || 'Elder'}
            </h2>
            <p className="text-[11px] text-white/45 mt-0.5">
              {updatedAt ? `Updated ${updatedAt}` : 'Waiting for GPS signal…'}
            </p>
          </div>

          {/* Status badge */}
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border whitespace-nowrap ${
            !hasSafeZone  ? 'bg-amber-500/20 border-amber-400/30 text-amber-300' :
            is_breached   ? 'bg-red-500/30 border-red-400/40 text-red-300 animate-pulse' :
                            'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
          }`}>
            {!hasSafeZone ? 'ZONE NOT SET' : is_breached ? '🚨 BREACH' : '✓ SAFE'}
          </span>

          {/* Settings / gear toggle */}
          <motion.button
            onClick={() => setDrawerOpen(v => !v)}
            whileHover={{ rotate: drawerOpen ? -30 : 30 }}
            whileTap={{ scale: 0.9 }}
            aria-label={drawerOpen ? 'Close settings' : 'Open settings'}
            aria-expanded={drawerOpen}
            aria-controls="tracker-drawer"
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-xl bg-white/8 border border-white/12 text-white/50 hover:text-white hover:bg-white/15 transition-colors shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </motion.button>
        </div>

        {/* Distance progress — only when everything is available */}
        {hasSafeZone && distance_meters != null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/50">Distance from Safe Zone</p>
              <p className={`text-sm font-black ${is_breached ? 'text-red-300' : 'text-emerald-300'}`}>
                {formatDistance(distance_meters)}
              </p>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${is_breached
                  ? 'bg-gradient-to-r from-red-500 to-orange-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-white/25">Safe radius: {formatDistance(radius)}</p>
          </div>
        )}

        {/* No location placeholder */}
        {!hasLocation && (
          <p className="text-xs text-white/35 text-center py-1">
            Waiting for elder's device to share location…
          </p>
        )}
      </div>

      {/* ── Sliding settings drawer ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {drawerOpen && (
          <motion.div
            id="tracker-drawer"
            key="drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/10 pt-4">

              {/* Lat / Lng grid */}
              {hasLocation && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Latitude',  val: lat.toFixed(6) },
                    { label: 'Longitude', val: lng.toFixed(6) },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-wider text-white/35">{label}</p>
                      <p className="text-sm font-black text-white font-mono mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Safe zone centre coordinates */}
              {hasSafeZone && (
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/35 mb-1">Safe Zone Centre</p>
                  <p className="text-xs font-mono text-white/70">
                    {safeZone.lat.toFixed(6)}, {safeZone.lng.toFixed(6)}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">Radius: {formatDistance(radius)}</p>
                </div>
              )}

              {/* Maps deep-links */}
              {hasLocation && (
                <div className="flex gap-2">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-white/8 border border-white/12 text-white/70 hover:bg-white/15 hover:text-white transition-colors">
                      📍 Current Pin
                    </a>
                  )}
                  {homeUrl && (
                    <a href={homeUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-white/8 border border-white/12 text-white/70 hover:bg-white/15 hover:text-white transition-colors">
                      🏠 Safe Zone Pin
                    </a>
                  )}
                </div>
              )}

              {/* Set / Update Safe Zone button */}
              {hasLocation && (
                <motion.button
                  onClick={handleSetSafeZone}
                  disabled={settingZone}
                  whileHover={settingZone ? {} : { scale: 1.02 }}
                  whileTap={settingZone ? {} : { scale: 0.97 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-emerald-900 bg-emerald-400 hover:bg-emerald-300 shadow-md shadow-emerald-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingZone ? (
                    <><span className="w-4 h-4 border-2 border-emerald-700/40 border-t-emerald-900 rounded-full animate-spin" aria-hidden="true" /> Saving…</>
                  ) : (
                    hasSafeZone ? '🔄 Update Safe Zone to Current Location' : '🏠 Set Current Location as Safe Zone'
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ── Emergency Response Panel ──────────────────────────────────────────────────

function EmergencyPanel({ elderlyName, phone, onResolve, resolving }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: -12 }}
      animate={{ opacity: 1, scale: 1,    y: 0     }}
      exit={{    opacity: 0, scale: 0.97, y: -12   }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border-2 border-red-500 bg-gradient-to-br from-red-700 via-red-800 to-rose-900 shadow-2xl shadow-red-500/40"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Pulsing overlay */}
      <div className="absolute inset-0 bg-red-400/10 animate-pulse pointer-events-none rounded-3xl" aria-hidden="true" />

      {/* Accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-red-400 via-orange-300 to-red-400 animate-pulse" aria-hidden="true" />

      <div className="relative px-5 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/20 shrink-0 animate-pulse">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12a7 7 0 0 1 14 0" />
              <path d="M3 18a9 9 0 0 1 18 0" />
              <circle cx="12" cy="19" r="2" fill="white" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-red-300 mb-1 animate-pulse">
              🚨 HIGH PRIORITY ALERT
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              Emergency Triggered!
            </h2>
            <p className="text-red-200 text-sm font-medium mt-1.5 leading-relaxed">
              <span className="font-bold text-white">{elderlyName || 'Your loved one'}</span>{' '}
              has pressed the Emergency Panic Button. Immediate action is required.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10" aria-hidden="true" />

        {/* Maps link */}
        <motion.a
          href="https://www.google.com/maps/search/?api=1&query=24.8607,67.0011"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-2xl font-bold text-sm bg-white/10 border border-white/20 text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white"
          aria-label="Open live location in Google Maps"
        >
          <span aria-hidden="true">📍</span>
          Track Live Location
        </motion.a>

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Call Elder — native phone dialer via tel: protocol */}
          <motion.a
            href={phone ? `tel:${phone}` : '#'}
            whileHover={{ scale: 1.03, backgroundColor: 'rgba(99,102,241,0.85)' }}
            whileTap={{ scale: 0.96 }}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 px-4 rounded-2xl font-black text-sm
              bg-indigo-600 border-2 border-indigo-400/60 text-white
              shadow-lg shadow-indigo-900/40
              transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-indigo-300"
            aria-label={`Call ${elderlyName || 'the elderly person'}${phone ? ' at ' + phone : ''}`}
          >
            <PhoneIcon size={18} />
            <span>Call Elder</span>
            {phone && (
              <span className="text-indigo-200 font-normal text-xs truncate max-w-[90px]">
                {phone}
              </span>
            )}
          </motion.a>

          {/* Emergency Helpline — direct dial 1122 */}
          <motion.a
            href="tel:1122"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 px-4 rounded-2xl font-black text-sm
              bg-white text-red-700
              border-2 border-red-200
              shadow-lg shadow-red-900/25
              hover:bg-red-50
              transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-red-400"
            aria-label="Call emergency helpline 1122"
          >
            <span className="text-lg leading-none" aria-hidden="true">🚑</span>
            <span>Helpline 1122</span>
          </motion.a>

          {/* Mark as Resolved — async Firestore update */}
          <motion.button
            onClick={onResolve}
            disabled={resolving}
            whileHover={resolving ? {} : { scale: 1.03 }}
            whileTap={resolving ? {} : { scale: 0.96 }}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 px-4 rounded-2xl font-black text-sm
              bg-emerald-500 hover:bg-emerald-400 text-white
              border-2 border-emerald-400/50
              shadow-lg shadow-emerald-900/30
              transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-emerald-300
              disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Mark emergency as resolved"
          >
            {resolving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
            ) : (
              <span className="text-base leading-none" aria-hidden="true">✅</span>
            )}
            {resolving ? 'Resolving…' : 'Mark Resolved'}
          </motion.button>
        </div>

        <p className="text-red-300/60 text-[11px] text-center font-medium">
          Resolving will set status back to Safe and append a timestamped log entry.
        </p>
      </div>
    </motion.div>
  )
}

// ── Add Medicine Form ─────────────────────────────────────────────────────────

function AddMedicineForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ name: '', dose: '', time: 'Morning', clock: '' })
  const [saving, setSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.clock.trim()) return
    setSaving(true)
    await onAdd(form)
    setSaving(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col gap-3"
      aria-label="Add medicine form"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="fam-med-name">Medicine Name *</label>
          <input
            ref={nameRef}
            id="fam-med-name"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Aspirin"
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="fam-med-dose">Dose</label>
          <input
            id="fam-med-dose"
            value={form.dose}
            onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
            placeholder="e.g. 100mg"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="fam-med-time">Time of Day</label>
          <select
            id="fam-med-time"
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            className={inputCls}
          >
            {['Morning', 'Afternoon', 'Evening', 'Night'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="fam-med-clock">Clock Time *</label>
          <input
            id="fam-med-clock"
            required
            value={form.clock}
            onChange={e => setForm(f => ({ ...f, clock: e.target.value }))}
            placeholder="e.g. 8:00 AM"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 text-sm font-bold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {saving && (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
          )}
          Add Medicine
        </button>
      </div>
    </form>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FamilyDashboard({ groupData, careCode, userProfile }) {
  const [showForm, setShowForm]   = useState(false)
  const [removing, setRemoving]   = useState(null)
  const [resolving, setResolving] = useState(false)

  // ── Inline edit state ─────────────────────────────────────────────────────
  // editingId: the id of the medicine row currently open for editing (or null)
  // editDraft: live form values while the row is in edit mode
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ name: '', dose: '', time: 'Morning', clock: '' })
  const [saving, setSaving]       = useState(false)

  const status = groupData?.status || 'unknown'
  const medicines = groupData?.medicines || []
  const logs = [...(groupData?.activity_logs || [])]
    .reverse()
    // Show only events triggered by the elder — exclude family management actions
    .filter(l => ['emergency', 'checkin', 'symptom', 'geo_breach', 'geo_return'].includes(l.type))
    .slice(0, 30)
  const meta = STATUS_META[status] || STATUS_META.unknown
  const isEmergency = status === 'emergency'
  const groupRef = doc(db, 'care_groups', careCode)

  // ── Voice alert via Web Speech API ───────────────────────────────────────
  // Speaks a looping alert when status transitions to 'emergency',
  // and cancels speech as soon as status leaves 'emergency'.
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return

    if (isEmergency) {
      // Cancel any leftover speech before starting
      synth.cancel()

      const message = 'Emergency! Emergency! Please check on your elder immediately!'
      let stopped = false

      function speak() {
        if (stopped || !isEmergency) return
        const utterance = new SpeechSynthesisUtterance(message)
        utterance.rate  = 0.95
        utterance.pitch = 1.1
        utterance.volume = 1
        // Repeat after each utterance finishes, while still in emergency
        utterance.onend = () => { if (!stopped) speak() }
        synth.speak(utterance)
      }

      speak()

      // Cleanup: stop speech when component re-renders out of emergency
      return () => {
        stopped = true
        synth.cancel()
      }
    } else {
      // Status left emergency — cancel any ongoing speech immediately
      synth.cancel()
    }
  }, [isEmergency])

  // ── Web Audio alarm ───────────────────────────────────────────────────────
  // Generates a loud pulsing siren tone via the Web Audio API.
  // Only fires when status is 'emergency' and the tab is open.
  // Stops immediately when status leaves 'emergency'.
  // NOTE: browser requires a prior user gesture (click) before AudioContext
  // can produce sound — this is satisfied because the family opened the tab
  // and interacted with the dashboard before any emergency can occur.
  useEffect(() => {
    if (!isEmergency) return

    let ctx = null
    let intervalId = null
    let stopped = false

    function playBeep() {
      if (stopped) return
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)()
        // Two-tone ambulance siren: oscillates between 880 Hz and 1100 Hz
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type      = 'sawtooth'     // harsher, more attention-grabbing than sine
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.4)
        osc.frequency.linearRampToValueAtTime(880,  ctx.currentTime + 0.8)

        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.05) // fast attack
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.85) // fade out

        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.9)

        osc.onended = () => ctx?.close()
      } catch (err) {
        console.warn('Audio alarm error:', err)
      }
    }

    // Play immediately, then repeat every 1.1 s
    playBeep()
    intervalId = setInterval(playBeep, 1100)

    return () => {
      stopped = true
      clearInterval(intervalId)
      ctx?.close()
    }
  }, [isEmergency])

  // ── Browser Push notification ─────────────────────────────────────────────
  // Fires a native OS notification the first time status becomes 'emergency'.
  // Requires the family member to have granted notification permission.
  // We request permission on first emergency so the prompt feels contextual.
  useEffect(() => {
    if (!isEmergency) return
    if (!('Notification' in window)) return

    async function fireNotification() {
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') return

      new Notification('🚨 CareConnect Emergency', {
        body:    `${groupData?.elderlyName || 'Your elder'} has pressed the Emergency Panic Button. Open the app immediately.`,
        icon:    '/favicon.svg',
        badge:   '/favicon.svg',
        tag:     'careconnect-emergency',   // replaces any previous notification with same tag
        renotify: true,                     // re-fires sound/vibration even if same tag exists
        requireInteraction: true,           // notification stays until dismissed (desktop)
      })
    }

    fireNotification()
  }, [isEmergency])

  // ── Mark emergency as resolved ───────────────────────────────────────────
  async function handleResolve() {
    setResolving(true)
    try {
      await updateDoc(groupRef, {
        status: 'safe',
        activity_logs: arrayUnion({
          type: 'resolved',
          emoji: '✅',
          message: `Emergency handled and resolved by family member at ${fullTs()}`,
          time: ts(),
          id: Date.now(),
        }),
      })
    } finally {
      setResolving(false)
    }
  }

  // ── Add medicine ─────────────────────────────────────────────────────────
  async function handleAddMedicine(form) {
    const newMed = { ...form, id: Date.now(), taken: false }
    await updateDoc(groupRef, {
      medicines: arrayUnion(newMed),
      activity_logs: arrayUnion({
        type: 'medicine',
        emoji: '➕',
        message: `Medicine added: ${form.name}${form.dose ? ' ' + form.dose : ''} (${form.time}, ${form.clock})`,
        time: ts(),
        id: Date.now() + 1,
      }),
    })
    setShowForm(false)
  }

  // ── Clear all activity logs ───────────────────────────────────────────────
  async function handleClearActivity() {
    if (!window.confirm('Clear all elder activity logs? This cannot be undone.')) return
    await updateDoc(groupRef, { activity_logs: [] })
  }

  // ── Remove medicine ──────────────────────────────────────────────────────
  async function handleRemoveMedicine(med) {
    setRemoving(med.id)
    try {
      const updated = medicines.filter(m => m.id !== med.id)
      await updateDoc(groupRef, {
        medicines: updated,
        activity_logs: arrayUnion({
          type: 'medicine',
          emoji: '🗑️',
          message: `Removed medicine: ${med.name}`,
          time: ts(),
          id: Date.now(),
        }),
      })
    } finally {
      setRemoving(null)
    }
  }

  // ── Open inline edit — pre-fill draft with current values ─────────────────
  function openEdit(med) {
    setEditingId(med.id)
    setEditDraft({ name: med.name, dose: med.dose || '', time: med.time, clock: med.clock })
  }

  // ── Save inline edit — patch the medicines array in Firestore ─────────────
  async function handleUpdateMedicine(med) {
    if (!editDraft.name.trim() || !editDraft.clock.trim()) return
    setSaving(true)
    try {
      const prevLabel = `${med.name}${med.dose ? ' ' + med.dose : ''}`
      const nextLabel = `${editDraft.name.trim()}${editDraft.dose.trim() ? ' ' + editDraft.dose.trim() : ''}`
      const updated = medicines.map(m =>
        m.id === med.id
          ? { ...m, name: editDraft.name.trim(), dose: editDraft.dose.trim(), time: editDraft.time, clock: editDraft.clock.trim() }
          : m
      )
      await updateDoc(groupRef, {
        medicines: updated,
        activity_logs: arrayUnion({
          type:    'medicine_edit',
          emoji:   '✏️',
          message: `Updated medicine: '${prevLabel}' → '${nextLabel}' (${editDraft.time}, ${editDraft.clock.trim()})`,
          time:    ts(),
          id:      Date.now(),
        }),
      })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 pb-16">

      {/* ── Emergency Response Panel — full width when active ────────────── */}
      <AnimatePresence>
        {isEmergency && (
          <div className="mb-6">
            <EmergencyPanel
              elderlyName={groupData?.elderlyName}
              phone={groupData?.phone}
              onResolve={handleResolve}
              resolving={resolving}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white shrink-0">
          <ShieldIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Family Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoring:{' '}
            <span className="font-bold text-slate-600">{groupData?.elderlyName || 'Your loved one'}</span>
            {' · '}Code:{' '}
            <span className="font-mono font-bold text-indigo-600">{careCode}</span>
          </p>
        </div>
      </div>

      {/* ── Responsive grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT column (spans 2 on lg) — monitoring cards ───────────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Live Tracker Widget */}
          <LiveTrackerWidget
            liveLocation={groupData?.live_location}
            elderlyName={groupData?.elderlyName}
            groupRef={groupRef}
            safeZone={
              groupData?.safe_lat && groupData?.safe_lng
                ? { lat: groupData.safe_lat, lng: groupData.safe_lng, radius: groupData.safe_radius_meters ?? 200 }
                : null
            }
          />

          {/* Live Status */}
          <section aria-labelledby="fam-status-heading">
            <h2
              id="fam-status-heading"
              className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2.5 px-1"
            >
              Live Status
            </h2>
            <div
              className={`relative rounded-3xl border-2 ${meta.bg} ${meta.border} px-5 py-5 flex items-center gap-4 overflow-hidden transition-all duration-500`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {isEmergency && (
                <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" aria-hidden="true" />
              )}
              <div className={`p-3 rounded-2xl ${meta.badge}`}>
                <span className="text-3xl leading-none">{meta.emoji}</span>
              </div>
              <div className="flex-1">
                <p className={`text-xl font-black ${meta.color}`}>{meta.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Synced live from Firestore</p>
              </div>
              {isEmergency && (
                <span className="flex items-center gap-1.5 animate-pulse bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow shadow-red-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
                  ALERT
                </span>
              )}
            </div>
          </section>

          {/* Medicine management */}
          <section
            aria-labelledby="fam-med-heading"
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
              <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><PillIcon /></span>
              <h2 id="fam-med-heading" className="text-base font-black text-slate-800">Medicine Log</h2>
              {/* Adherence ring */}
              {medicines.length > 0 && (
                <div className="ml-1">
                  <AdherenceRing
                    pct={Math.round((medicines.filter(m => m.taken).length / medicines.length) * 100)}
                    size={44}
                    stroke={4}
                  />
                </div>
              )}
              <button
                onClick={() => setShowForm(v => !v)}
                aria-expanded={showForm}
                aria-controls="med-form"
                className={`ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-150 ${
                  showForm
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-300'
                }`}
              >
                <PlusIcon />
                {showForm ? 'Cancel' : 'Add Medicine'}
              </button>
            </div>

            {showForm && (
              <div id="med-form" className="px-5 pb-2">
                <AddMedicineForm onAdd={handleAddMedicine} onCancel={() => setShowForm(false)} />
              </div>
            )}

            <ul className="divide-y divide-slate-50" aria-label="Medicine list">
              {medicines.length === 0 && (
                <li className="px-5 py-8 text-center text-slate-400 text-sm">
                  No medicines added yet. Use "+ Add Medicine" to get started.
                </li>
              )}
              {[...medicines]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(med => (
                  <li key={med.id} className="relative">
                    <AnimatePresence initial={false} mode="wait">

                      {/* ── INLINE EDIT FORM ─────────────────────────────── */}
                      {editingId === med.id ? (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="px-5 py-4 bg-indigo-50/60 border-l-4 border-indigo-400"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {/* Name */}
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Medicine Name *
                              </label>
                              <input
                                autoFocus
                                value={editDraft.name}
                                onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                                placeholder="e.g. Panadol Extra"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                              />
                            </div>
                            {/* Dose */}
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Dose
                              </label>
                              <input
                                value={editDraft.dose}
                                onChange={e => setEditDraft(d => ({ ...d, dose: e.target.value }))}
                                placeholder="e.g. 500mg"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                              />
                            </div>
                            {/* Time of day */}
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Time of Day
                              </label>
                              <select
                                value={editDraft.time}
                                onChange={e => setEditDraft(d => ({ ...d, time: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                              >
                                {['Morning', 'Afternoon', 'Evening', 'Night'].map(t => (
                                  <option key={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            {/* Clock time */}
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Clock Time *
                              </label>
                              <input
                                value={editDraft.clock}
                                onChange={e => setEditDraft(d => ({ ...d, clock: e.target.value }))}
                                placeholder="e.g. 8:00 AM"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                              />
                            </div>
                          </div>
                          {/* Action row */}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateMedicine(med)}
                              disabled={saving || !editDraft.name.trim() || !editDraft.clock.trim()}
                              className="flex-1 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              {saving ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                              ) : (
                                '✓ Save Changes'
                              )}
                            </button>
                          </div>
                        </motion.div>

                      ) : (

                      /* ── STATIC ROW ────────────────────────────────────── */
                        <motion.div
                          key="view"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Pill icon */}
                          <div className={`p-2 rounded-xl shrink-0 ${med.taken ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                            <PillIcon />
                          </div>

                          {/* Name + timing */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800">
                              {med.name}
                              {med.dose && <span className="ml-1.5 font-normal text-slate-400">{med.dose}</span>}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <ClockIcon />{med.time} · {med.clock}
                            </p>
                          </div>

                          {/* Status + action icons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${med.taken ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {med.taken ? 'Taken' : 'Pending'}
                            </span>

                            {/* Edit button — visible on group hover */}
                            <button
                              onClick={() => openEdit(med)}
                              aria-label={`Edit ${med.name}`}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-indigo-400"
                            >
                              <PencilIcon />
                            </button>

                            {/* Delete button — visible on group hover */}
                            <button
                              onClick={() => handleRemoveMedicine(med)}
                              disabled={removing === med.id}
                              aria-label={`Remove ${med.name}`}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-400"
                            >
                              {removing === med.id ? (
                                <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin block" aria-hidden="true" />
                              ) : (
                                <TrashIcon />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </li>
                ))}
            </ul>
          </section>

        </div>{/* end left column */}

        {/* ── RIGHT column — AI insight + activity log ──────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* Nearby Emergency Hospitals */}
          <NearbyHospitals liveLocation={groupData?.live_location} />

          {/* AI Health Companion Insight */}
          <AiInsights status={status} logs={logs} medicines={medicines} />

          {/* Activity log */}
          <section
            aria-labelledby="fam-activity-heading"
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
              <span className="p-2 rounded-xl bg-sky-50 text-sky-600"><ActivityIcon /></span>
              <h2 id="fam-activity-heading" className="text-base font-black text-slate-800">Elder Activity</h2>
              {logs.length > 0 && (
                <>
                  <span className="text-[11px] font-bold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">
                    {logs.length} events
                  </span>
                  <button
                    onClick={handleClearActivity}
                    title="Clear all activity logs"
                    aria-label="Clear all elder activity logs"
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-red-400"
                  >
                    {/* Broom / clear icon */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                    Clear
                  </button>
                </>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-slate-300 text-3xl mb-2" aria-hidden="true">📭</p>
                <p className="text-slate-400 text-sm font-medium">No elder activity recorded yet.</p>
                <p className="text-slate-300 text-xs mt-1">Check-ins, SOS alerts, symptoms, and location events will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 max-h-[32rem] overflow-y-auto" aria-label="Activity log">
                {logs.map(entry => (
                  <li
                    key={entry.id}
                    className={`flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-slate-50/80 ${
                      entry.type === 'emergency'
                        ? 'bg-red-50/60'
                        : entry.type === 'checkin' || entry.type === 'resolved'
                        ? 'bg-emerald-50/60'
                        : ''
                    }`}
                  >
                    <span className="text-lg mt-0.5 shrink-0" aria-hidden="true">{entry.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 leading-snug">{entry.message}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <ClockIcon />{entry.time}
                      </p>
                    </div>
                    {entry.type === 'emergency' && (
                      <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                        URGENT
                      </span>
                    )}
                    {entry.type === 'resolved' && (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        RESOLVED
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>{/* end right column */}

      </div>{/* end grid */}
    </div>
  )
}
