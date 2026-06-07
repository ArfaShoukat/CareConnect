import { motion } from 'framer-motion'
import { ArrowRightIcon, SirenIcon, PillIcon, ShieldIcon, HeartIcon, BellIcon, ActivityIcon } from './Icons'

// ── Animation variants ────────────────────────────────────────────────────────

// Staggered children container
const stagger = (delayChildren = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delayChildren, delayChildren: 0.05 } },
})

// Generic fade-up — used for hero elements and scroll-reveal cards
const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
  },
})

// Clip-reveal for the hero heading words
const clipReveal = (delay = 0) => ({
  hidden: { clipPath: 'inset(0 0 100% 0)', opacity: 0, y: 16 },
  show: {
    clipPath: 'inset(0 0 0% 0)',
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay },
  },
})

// Scroll-reveal variant (used with whileInView)
const scrollFadeUp = {
  hidden: { opacity: 0, y: 36 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: <SirenIcon size={22} />,
    color: 'bg-red-50 text-red-500',
    iconHover: 'group-hover:bg-red-100 group-hover:text-red-600',
    title: 'SOS Emergency Alerts',
    desc: 'One tap sends an immediate alert to every connected family member with a real-time timestamp.',
  },
  {
    icon: <PillIcon size={22} />,
    color: 'bg-violet-50 text-violet-500',
    iconHover: 'group-hover:bg-violet-100 group-hover:text-violet-600',
    title: 'Medication Sync',
    desc: 'Family members add and manage medicines remotely. Elderly users see reminders instantly.',
  },
  {
    icon: <ShieldIcon size={22} />,
    color: 'bg-emerald-50 text-emerald-500',
    iconHover: 'group-hover:bg-emerald-100 group-hover:text-emerald-600',
    title: 'Secure Care Circle',
    desc: 'A unique Care Code links elderly users to their family group — private and encrypted.',
  },
  {
    icon: <HeartIcon size={22} />,
    color: 'bg-pink-50 text-pink-500',
    iconHover: 'group-hover:bg-pink-100 group-hover:text-pink-600',
    title: 'Daily Check-Ins',
    desc: 'Simple one-tap check-in keeps family members updated and sets everyone at ease.',
  },
  {
    icon: <ActivityIcon size={22} />,
    color: 'bg-amber-50 text-amber-500',
    iconHover: 'group-hover:bg-amber-100 group-hover:text-amber-600',
    title: 'Real-time Activity Log',
    desc: 'Every event — check-ins, medicines, alerts — is logged with a timestamp for full visibility.',
  },
  {
    icon: <BellIcon size={22} />,
    color: 'bg-sky-50 text-sky-500',
    iconHover: 'group-hover:bg-sky-100 group-hover:text-sky-600',
    title: 'Always-on Monitoring',
    desc: 'Live Firestore sync means status updates appear instantly across all devices, no refresh needed.',
  },
]

const steps = [
  { step: '01', title: 'Elderly signs up', desc: 'Creates an account and receives a unique Care Code.' },
  { step: '02', title: 'Family joins',     desc: 'Registers with the Care Code to link to the care group.' },
  { step: '03', title: 'Stay connected',   desc: 'Real-time alerts, check-ins, and medicine reminders — live.' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage({ onOpenAuth }) {
  return (
    <div className="flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">

        {/* Background image — no animation, instant */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=80"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/92 via-indigo-950/78 to-slate-900/40" />
        </div>

        {/* Hero content — staggered mount animation */}
        <motion.div
          className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-24 flex flex-col gap-8 max-w-2xl"
          variants={stagger(0.12)}
          initial="hidden"
          animate="show"
        >
          {/* Live badge */}
          <motion.div variants={fadeUp(0)} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="text-white/80 text-xs font-semibold tracking-wide">Live · Secure · Always Connected</span>
          </motion.div>

          {/* Heading — clip-reveal per line */}
          <div className="flex flex-col gap-1 overflow-hidden">
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1]"
              variants={clipReveal(0.1)}
            >
              Care that connects
            </motion.h1>
            <motion.div variants={clipReveal(0.22)}>
              <span className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] bg-gradient-to-r from-indigo-400 via-violet-300 to-pink-400 bg-clip-text text-transparent">
                every family.
              </span>
            </motion.div>
          </div>

          {/* Description */}
          <motion.p variants={fadeUp(0.3)} className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-xl">
            CareConnect gives elderly loved ones a safety net and gives families real-time peace of mind —
            emergency alerts, medication reminders, and daily check-ins, all in one place.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={fadeUp(0.4)} className="flex flex-col sm:flex-row gap-3">
            <motion.button
              onClick={() => onOpenAuth('signup')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 transition-colors duration-200 text-base"
            >
              Start Free Today
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                <ArrowRightIcon size={18} />
              </span>
            </motion.button>

            <motion.button
              onClick={() => onOpenAuth('login')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center px-7 py-4 rounded-2xl font-bold text-white/90 border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur transition-colors duration-200 text-base"
            >
              Log In
            </motion.button>
          </motion.div>

          {/* Subtext */}
          <motion.p variants={fadeUp(0.5)} className="text-slate-400 text-sm">
            No credit card needed · Free to use · Set up in minutes
          </motion.p>
        </motion.div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">

          {/* Section heading */}
          <motion.div
            className="text-center flex flex-col gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp()}
          >
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Up and running in three steps.</h2>
          </motion.div>

          {/* Step cards — staggered scroll reveal */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.13)}
          >
            {steps.map(({ step, title, desc }) => (
              <motion.div
                key={step}
                variants={scrollFadeUp}
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(99,102,241,0.18)' }}
                className="flex flex-col gap-3 p-6 rounded-3xl border border-slate-100 bg-white shadow-sm transition-colors duration-200"
              >
                <span className="text-4xl font-black bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent">
                  {step}
                </span>
                <h3 className="font-black text-slate-800 text-base">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">

          {/* Section heading */}
          <motion.div
            className="text-center flex flex-col gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp()}
          >
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Why CareConnect</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              Everything your family needs,<br className="hidden sm:block" /> in one simple app.
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Designed for elderly users who need simplicity and families who need clarity.
            </p>
          </motion.div>

          {/* Feature cards — staggered scroll reveal */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.08)}
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={scrollFadeUp}
                whileHover={{
                  y: -5,
                  scale: 1.02,
                  boxShadow: '0 16px 40px -12px rgba(99,102,241,0.15)',
                }}
                whileTap={{ scale: 0.985 }}
                className="group flex flex-col gap-4 p-6 rounded-3xl border border-slate-100 hover:border-indigo-100 cursor-default transition-colors duration-200"
              >
                {/* Icon — micro-interaction: scale + color shift on card hover */}
                <motion.div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors duration-200 ${f.color} ${f.iconHover}`}
                  whileHover={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 0.35 }}
                >
                  {f.icon}
                </motion.div>

                <div>
                  <h3 className="font-black text-slate-800 text-base mb-1.5">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 py-24 px-4 sm:px-6">
        <motion.div
          className="max-w-2xl mx-auto text-center flex flex-col gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.15)}
        >
          <motion.h2 variants={fadeUp()} className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Give your family the gift of safety.
          </motion.h2>
          <motion.p variants={fadeUp(0.1)} className="text-indigo-100 text-lg">
            Set up CareConnect in minutes and start monitoring what matters most.
          </motion.p>
          <motion.div variants={fadeUp(0.2)}>
            <motion.button
              onClick={() => onOpenAuth('signup')}
              whileHover={{ scale: 1.05, boxShadow: '0 12px 32px -8px rgba(255,255,255,0.25)' }}
              whileTap={{ scale: 0.97 }}
              className="group inline-flex items-center justify-center gap-2.5 mx-auto px-8 py-4 rounded-2xl font-bold text-indigo-700 bg-white hover:bg-indigo-50 shadow-xl transition-colors duration-150 text-base"
            >
              Create Your Care Circle
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                <ArrowRightIcon size={18} />
              </span>
            </motion.button>
          </motion.div>
        </motion.div>
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
