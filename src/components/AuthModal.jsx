import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { XIcon, EyeIcon, EyeOffIcon, KeyIcon, PhoneIcon, LogoIcon } from './Icons'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a unique 6-char care code in the format CC-XXXX */
function generateCareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'CC-'
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200'

const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5'

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthModal({ mode, onClose, onSwitch }) {
  const isLogin = mode === 'login'

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'elderly',
    careCode: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, form.email.trim(), form.password)
        onClose()
        return
      }

      // ── Signup flow ──────────────────────────────────────────────────────
      const { user } = await createUserWithEmailAndPassword(
        auth, form.email.trim(), form.password
      )

      if (form.role === 'elderly') {
        const careCode = generateCareCode()

        // Create the care group document
        await setDoc(doc(db, 'care_groups', careCode), {
          careCode,
          elderlyUid: user.uid,
          elderlyName: form.name.trim(),
          elderlyEmail: form.email.trim(),
          phone: form.phone.trim(),
          status: 'unknown',
          medicines: [],
          activity_logs: [],
          members: [user.uid],
          createdAt: new Date().toISOString(),
        })

        // Save user profile
        await setDoc(doc(db, 'users', user.uid), {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: 'elderly',
          careCode,
        })
      } else {
        // Family member — look up the provided care code
        const code = form.careCode.trim().toUpperCase()
        const groupRef = doc(db, 'care_groups', code)
        const groupSnap = await getDoc(groupRef)

        if (!groupSnap.exists()) {
          setError('Care Code not found. Please check and try again.')
          // Clean up the just-created auth user so they can retry
          await user.delete()
          setLoading(false)
          return
        }

        await updateDoc(groupRef, { members: arrayUnion(user.uid) })

        await setDoc(doc(db, 'users', user.uid), {
          name: form.name.trim(),
          email: form.email.trim(),
          role: 'family',
          careCode: code,
        })
      }

      onClose()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
      aria-modal="true"
      role="dialog"
      aria-label={isLogin ? 'Log in to CareConnect' : 'Create a CareConnect account'}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal">

        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

        <div className="p-7 sm:p-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-7">
            <div className="flex items-center gap-3">
              <LogoIcon size={36} />
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {isLogin ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLogin ? 'Sign in to your care dashboard' : 'Join the CareConnect family'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <XIcon />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Full Name — signup only */}
            {!isLogin && (
              <div>
                <label className={labelCls} htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  required
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Your full name"
                  className={inputCls}
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className={labelCls} htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                required
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className={labelCls} htmlFor="auth-pass">Password</label>
              <div className="relative">
                <input
                  id="auth-pass"
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                  className={`${inputCls} pr-11`}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Role selector — signup only */}
            {!isLogin && (
              <div>
                <label className={labelCls}>I am a…</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { val: 'elderly', label: '👴 Elderly User', sub: 'I need care' },
                    { val: 'family', label: '👨‍👩‍👧 Family Member', sub: 'I provide care' },
                  ].map(({ val, label, sub }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => set('role', val)}
                      className={`flex flex-col items-center gap-1 p-3.5 rounded-2xl border-2 text-sm font-bold transition-all duration-200 ${
                        form.role === val
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:border-indigo-200'
                      }`}
                    >
                      {label}
                      <span className={`text-xs font-normal ${form.role === val ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Number — elderly signup only */}
            {!isLogin && form.role === 'elderly' && (
              <div>
                <label className={labelCls} htmlFor="auth-phone">
                  <span className="flex items-center gap-1.5"><PhoneIcon /> Phone Number</span>
                </label>
                <input
                  id="auth-phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className={inputCls}
                  autoComplete="tel"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Family members can call you directly from the emergency alert panel.
                </p>
              </div>
            )}

            {/* Care Code input — family signup only */}
            {!isLogin && form.role === 'family' && (
              <div>
                <label className={labelCls} htmlFor="auth-code">
                  <span className="flex items-center gap-1.5"><KeyIcon /> Care Code</span>
                </label>
                <input
                  id="auth-code"
                  required
                  value={form.careCode}
                  onChange={e => set('careCode', e.target.value)}
                  placeholder="e.g. CC-A3BX"
                  className={`${inputCls} font-mono tracking-widest uppercase`}
                  maxLength={7}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Ask the elderly member for their Care Code to link your accounts.
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3.5 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
              )}
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-slate-500 mt-5">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={onSwitch}
              className="font-bold text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline transition-colors"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
