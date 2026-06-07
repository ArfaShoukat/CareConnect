import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { LogoIcon, UserIcon } from './Icons'

export default function Navbar({ user, userProfile, onOpenAuth }) {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut(auth)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-200/60 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <LogoIcon size={38} />
          <div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
              CareConnect
            </span>
            <p className="text-[10px] text-slate-400 font-semibold leading-none mt-0.5 tracking-widest uppercase hidden sm:block">
              Health &amp; Safety Platform
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              {/* User chip */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white">
                  <UserIcon size={13} />
                </div>
                <div className="leading-none">
                  <p className="text-xs font-bold text-slate-700">{userProfile?.name || user.email}</p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{userProfile?.role || 'Member'}</p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {signingOut && (
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" aria-hidden="true" />
                )}
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                Log In
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-200 transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
