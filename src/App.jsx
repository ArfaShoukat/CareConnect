import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase/config'

import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import AuthModal from './components/AuthModal'
import ElderlyDashboard from './components/ElderlyDashboard'
import FamilyDashboard from './components/FamilyDashboard'

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  // undefined = still initializing, null = logged out, object = logged in
  const [user, setUser] = useState(undefined)
  const [userProfile, setUserProfile] = useState(null)

  // ── Firestore real-time care group data ───────────────────────────────────
  const [groupData, setGroupData] = useState(null)
  const [groupLoading, setGroupLoading] = useState(false)

  // ── Auth modal state ──────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState(null) // 'login' | 'signup' | null

  // ── Listen to Firebase Auth changes ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        // Fetch user profile from Firestore.
        // On fresh signup the profile document may not exist yet (race between
        // createUserWithEmailAndPassword resolving and the setDoc completing).
        // We do an initial getDoc; if the document is missing we fall back to
        // a real-time onSnapshot that resolves as soon as the write lands.
        const profileRef = doc(db, 'users', firebaseUser.uid)
        const profileSnap = await getDoc(profileRef)

        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data())
        } else {
          // Document not written yet — subscribe and pick it up when it arrives
          const unsubProfile = onSnapshot(profileRef, (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data())
              unsubProfile() // unsubscribe once we have the data — no leak
            }
          })
        }
      } else {
        setUserProfile(null)
        setGroupData(null)
      }
    })
    return unsub
  }, [])

  // ── Subscribe to care group via onSnapshot once careCode is available ─────
  useEffect(() => {
    if (!userProfile?.careCode) {
      setGroupData(null)
      return
    }

    setGroupLoading(true)

    const unsub = onSnapshot(
      doc(db, 'care_groups', userProfile.careCode),
      (snap) => {
        setGroupData(snap.exists() ? snap.data() : null)
        setGroupLoading(false)
      },
      (err) => {
        console.error('Firestore snapshot error:', err)
        setGroupLoading(false)
      }
    )

    return unsub
  }, [userProfile?.careCode])

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAuth = (mode) => setAuthMode(mode)
  const closeAuth = () => setAuthMode(null)
  const switchAuth = () => setAuthMode(m => (m === 'login' ? 'signup' : 'login'))

  // ── Auth initialization loading splash ────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-pink-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-hidden="true" />
          <p className="text-slate-400 text-sm font-semibold">Loading CareConnect…</p>
        </div>
      </div>
    )
  }

  // ── Determine the main view to render ─────────────────────────────────────
  function renderMain() {
    // Not logged in → public landing page
    if (!user) {
      return <LandingPage onOpenAuth={openAuth} />
    }

    // Logged in but profile still resolving (race condition on fresh signup)
    if (!userProfile) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-hidden="true" />
            <p className="text-slate-400 text-sm font-semibold">Setting up your account…</p>
          </div>
        </div>
      )
    }

    // Profile loaded, care group subscription in progress
    if (groupLoading) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-hidden="true" />
            <p className="text-slate-400 text-sm font-semibold">Loading your dashboard…</p>
          </div>
        </div>
      )
    }

    // Logged in but care group document not found
    if (!groupData) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <p className="text-4xl mb-4" aria-hidden="true">⚠️</p>
            <h2 className="text-xl font-black text-slate-800 mb-2">Care group not found</h2>
            <p className="text-slate-500 text-sm">
              We couldn't find a care group linked to your account. Please check your Care Code or contact support.
            </p>
          </div>
        </div>
      )
    }

    // Route by role
    if (userProfile.role === 'elderly') {
      return (
        <ElderlyDashboard
          groupData={groupData}
          careCode={userProfile.careCode}
          userProfile={userProfile}
        />
      )
    }

    if (userProfile.role === 'family') {
      return (
        <FamilyDashboard
          groupData={groupData}
          careCode={userProfile.careCode}
          userProfile={userProfile}
        />
      )
    }

    // Unknown role fallback
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400">Unknown account role. Please contact support.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-pink-50/20">
      <Navbar
        user={user}
        userProfile={userProfile}
        onOpenAuth={openAuth}
      />

      <main>
        {renderMain()}
      </main>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={closeAuth}
          onSwitch={switchAuth}
        />
      )}
    </div>
  )
}
