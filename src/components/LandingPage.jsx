import { ArrowRightIcon, SirenIcon, PillIcon, ShieldIcon, HeartIcon, BellIcon, ActivityIcon } from './Icons'

const features = [
  {
    icon: <SirenIcon size={22} />,
    color: 'bg-red-50 text-red-500',
    title: 'SOS Emergency Alerts',
    desc: 'One tap sends an immediate alert to every connected family member with a real-time timestamp.',
  },
  {
    icon: <PillIcon size={22} />,
    color: 'bg-violet-50 text-violet-500',
    title: 'Medication Sync',
    desc: 'Family members add and manage medicines remotely. Elderly users see reminders instantly.',
  },
  {
    icon: <ShieldIcon size={22} />,
    color: 'bg-emerald-50 text-emerald-500',
    title: 'Secure Care Circle',
    desc: 'A unique Care Code links elderly users to their family group — private and encrypted.',
  },
  {
    icon: <HeartIcon size={22} />,
    color: 'bg-pink-50 text-pink-500',
    title: 'Daily Check-Ins',
    desc: 'Simple one-tap check-in keeps family members updated and sets everyone at ease.',
  },
  {
    icon: <ActivityIcon size={22} />,
    color: 'bg-amber-50 text-amber-500',
    title: 'Real-time Activity Log',
    desc: 'Every event — check-ins, medicines, alerts — is logged with a timestamp for full visibility.',
  },
  {
    icon: <BellIcon size={22} />,
    color: 'bg-sky-50 text-sky-500',
    title: 'Always-on Monitoring',
    desc: 'Live Firestore sync means status updates appear instantly across all devices, no refresh needed.',
  },
]

const steps = [
  { step: '01', title: 'Elderly signs up', desc: 'Creates an account and receives a unique Care Code.' },
  { step: '02', title: 'Family joins', desc: 'Registers with the Care Code to link to the care group.' },
  { step: '03', title: 'Stay connected', desc: 'Real-time alerts, check-ins, and medicine reminders — live.' },
]

export default function LandingPage({ onOpenAuth }) {
  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=80"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/92 via-indigo-950/78 to-slate-900/40" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-24 flex flex-col gap-8 max-w-2xl">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="text-white/80 text-xs font-semibold tracking-wide">Live · Secure · Always Connected</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1]">
            Care that connects<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-pink-400 bg-clip-text text-transparent">
              every family.
            </span>
          </h1>

          <p className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-xl">
            CareConnect gives elderly loved ones a safety net and gives families real-time peace of mind —
            emergency alerts, medication reminders, and daily check-ins, all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onOpenAuth('signup')}
              className="group flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 transition-all duration-200 active:scale-95 text-base"
            >
              Start Free Today
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                <ArrowRightIcon size={18} />
              </span>
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="flex items-center justify-center px-7 py-4 rounded-2xl font-bold text-white/90 border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur transition-all duration-200 text-base"
            >
              Log In
            </button>
          </div>

          <p className="text-slate-400 text-sm">No credit card needed · Free to use · Set up in minutes</p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          <div className="text-center flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Up and running in three steps.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3 p-6 rounded-3xl border border-slate-100 bg-white shadow-sm">
                <span className="text-4xl font-black bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                  {step}
                </span>
                <h3 className="font-black text-slate-800 text-base">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          <div className="text-center flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Why CareConnect</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              Everything your family needs,<br className="hidden sm:block" /> in one simple app.
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Designed for elderly users who need simplicity and families who need clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group flex flex-col gap-4 p-6 rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 hover:scale-[1.02] transition-all duration-300 cursor-default"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${f.color}`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base mb-1.5">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center flex flex-col gap-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Give your family the gift of safety.
          </h2>
          <p className="text-indigo-100 text-lg">
            Set up CareConnect in minutes and start monitoring what matters most.
          </p>
          <button
            onClick={() => onOpenAuth('signup')}
            className="group inline-flex items-center justify-center gap-2.5 mx-auto px-8 py-4 rounded-2xl font-bold text-indigo-700 bg-white hover:bg-indigo-50 shadow-xl transition-all active:scale-95 text-base"
          >
            Create Your Care Circle
            <span className="group-hover:translate-x-1 transition-transform"><ArrowRightIcon size={18} /></span>
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-8 px-4 text-center">
        <p className="text-slate-500 text-sm">
          © {new Date().getFullYear()} CareConnect · Built with ❤️ for families everywhere
        </p>
      </footer>
    </div>
  )
}
