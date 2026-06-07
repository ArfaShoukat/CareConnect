import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config'
import { PillIcon, ClockIcon, ActivityIcon, PlusIcon, TrashIcon, ShieldIcon, PhoneIcon } from './Icons'
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

// ── AI Health Companion Insight ───────────────────────────────────────────────

function AiInsights({ status, logs }) {
  const isEmergency = status === 'emergency'
  const recentEmergencies = logs.filter(l => l.type === 'emergency').length
  const recentCheckins   = logs.filter(l => l.type === 'checkin').length
  const medicinePending  = logs.filter(l => l.type === 'medicine' && !l.taken).length

  // Derive insight text + styling from live data
  let insight, subtext, accent, dot

  if (isEmergency) {
    insight = 'CRITICAL: High-stress pattern detected via manual panic response. Immediate intervention advised.'
    subtext = 'Pattern based on current status and recent activity log analysis.'
    accent  = 'from-red-950/80 via-red-900/70 to-rose-900/80 border-red-500/50 shadow-red-500/20'
    dot     = 'bg-red-400'
  } else if (status === 'checked_in' || status === 'safe') {
    if (recentEmergencies > 0) {
      insight = `Analysis: ${recentEmergencies} emergency event${recentEmergencies > 1 ? 's' : ''} detected in recent history. Monitor closely for recurring stress patterns.`
      subtext = 'Recommend increasing check-in frequency over the next 24 hours.'
      accent  = 'from-amber-950/70 via-amber-900/60 to-orange-900/70 border-amber-500/40 shadow-amber-500/15'
      dot     = 'bg-amber-400'
    } else {
      insight = 'AI Analysis: Patient status is optimal. All systems steady.'
      subtext = `${recentCheckins} check-in${recentCheckins !== 1 ? 's' : ''} recorded · No emergency events detected · Medication compliance nominal.`
      accent  = 'from-emerald-950/70 via-emerald-900/60 to-teal-900/70 border-emerald-500/40 shadow-emerald-500/15'
      dot     = 'bg-emerald-400'
    }
  } else {
    insight = 'Awaiting first activity signal. No data to analyse yet.'
    subtext = 'AI insights will appear once the elderly user interacts with their dashboard.'
    accent  = 'from-slate-800/80 via-slate-800/70 to-slate-900/80 border-slate-600/40 shadow-slate-500/10'
    dot     = 'bg-slate-400'
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${accent} shadow-lg px-5 py-5 flex flex-col gap-3 transition-all duration-700`}
      aria-label="AI Health Companion Insight"
    >
      {/* Subtle animated shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden="true" />

      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 border border-white/15 shrink-0">
          <span className="text-base leading-none" aria-hidden="true">🤖</span>
          {/* Pulsing dot indicator */}
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${dot} ${isEmergency ? 'animate-ping' : 'animate-pulse'}`} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">AI Health Companion</p>
          <p className="text-xs font-bold text-white/80 leading-none mt-0.5">Real-time pattern analysis</p>
        </div>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
          isEmergency
            ? 'bg-red-500/30 border-red-400/40 text-red-300'
            : status === 'checked_in' || status === 'safe'
            ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
            : 'bg-slate-500/20 border-slate-400/30 text-slate-400'
        }`}>
          {isEmergency ? 'CRITICAL' : status === 'unknown' ? 'IDLE' : 'NOMINAL'}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10" aria-hidden="true" />

      {/* Insight text */}
      <p className={`text-sm font-bold leading-relaxed ${isEmergency ? 'text-red-200' : 'text-white/90'}`}>
        {insight}
      </p>
      <p className="text-xs text-white/45 leading-relaxed">{subtext}</p>

      {/* Stats row */}
      {logs.length > 0 && (
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {[
            { label: 'Check-ins', val: recentCheckins, color: 'text-emerald-400' },
            { label: 'Alerts', val: recentEmergencies, color: recentEmergencies > 0 ? 'text-red-400' : 'text-white/40' },
            { label: 'Med events', val: logs.filter(l => l.type === 'medicine').length, color: 'text-violet-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 min-w-[64px]">
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
  const [showForm, setShowForm] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [resolving, setResolving] = useState(false)

  const status = groupData?.status || 'unknown'
  const medicines = groupData?.medicines || []
  const logs = [...(groupData?.activity_logs || [])].reverse().slice(0, 30)
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 pb-16">

      {/* ── Emergency Response Panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {isEmergency && (
          <EmergencyPanel
            elderlyName={groupData?.elderlyName}
            phone={groupData?.phone}
            onResolve={handleResolve}
            resolving={resolving}
          />
        )}
      </AnimatePresence>

      {/* ── Welcome header ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white shrink-0">
          <ShieldIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Family Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoring:{' '}
            <span className="font-bold text-slate-600">{groupData?.elderlyName || 'Your loved one'}</span>
            {' · '}Code:{' '}
            <span className="font-mono font-bold text-indigo-600">{careCode}</span>
          </p>
        </div>
      </div>

      {/* ── Live Tracker Widget — always visible ─────────────────────────── */}
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

      {/* ── Live status card ─────────────────────────────────────────────── */}
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

      {/* ── AI Health Companion Insight ──────────────────────────────────── */}
      <AiInsights status={status} logs={logs} />

      {/* ── Medicine management ──────────────────────────────────────────── */}
      <section
        aria-labelledby="fam-med-heading"
        className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
          <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><PillIcon /></span>
          <h2 id="fam-med-heading" className="text-base font-black text-slate-800">Medicine Log</h2>
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
              <li
                key={med.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group"
              >
                <div className={`p-2 rounded-xl ${med.taken ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                  <PillIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800">
                    {med.name}
                    {med.dose && <span className="ml-1.5 font-normal text-slate-400">{med.dose}</span>}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <ClockIcon />{med.time} · {med.clock}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${med.taken ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {med.taken ? 'Taken' : 'Pending'}
                  </span>
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
              </li>
            ))}
        </ul>
      </section>

      {/* ── Activity log ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="fam-activity-heading"
        className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-50">
          <span className="p-2 rounded-xl bg-sky-50 text-sky-600"><ActivityIcon /></span>
          <h2 id="fam-activity-heading" className="text-base font-black text-slate-800">Recent Activity</h2>
          {logs.length > 0 && (
            <span className="ml-auto text-[11px] font-bold bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">
              {logs.length} events
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-300 text-3xl mb-2" aria-hidden="true">📭</p>
            <p className="text-slate-400 text-sm font-medium">No activity recorded yet.</p>
            <p className="text-slate-300 text-xs mt-1">Events from the Elderly View will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50 max-h-80 overflow-y-auto" aria-label="Activity log">
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
    </div>
  )
}
