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
  { step: '01', title: 'Elderly signs up',     desc: 'Creates an account and receives a unique Care Code.' },
  { step: '02', title: 'Family joins',        desc: 'Registers with the Care Code to link to the care group.' },
  { step: '03', title: 'Stay connected',      desc: 'Real-time alerts, check-ins, and medicine reminders — live.' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage({ onOpenAuth }) {
  return (
    <div className="flex flex-col font-['Plus_Jakarta_Sans',system-ui,sans-serif] antialiased selection:bg-indigo-500/10 selection:text-indigo-900 bg-slate-50">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-white px-4 sm:px-6 lg:px-8">

        {/* Background Layer with Soft Care Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=1400&auto=format&fit=crop&q=80"
            alt="Elderly care dashboard companion illustration"
            aria-hidden="true"
            className="w-full h-full object-cover object-center opacity-[0.07] filter scale-102 blur-[0.5px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
        </div>

        {/* Premium subtle light gradient orbs for a dashboard theme */}
        <div className="pointer-events-none absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-400/10 blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-[10%] right-[5%] w-[450px] h-[450px] rounded-full bg-emerald-400/10 blur-[100px]" aria-hidden="true" />

        <div className="relative z-10 max-w-7xl mx-auto w-full py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Side: Text and Actions */}
          <motion.div
            className="lg:col-span-7 flex flex-col gap-7 text-left max-w-xl"
            variants={stagger(0.12)}
            initial="hidden"
            animate="show"
          >
            {/* Live badge */}
            <motion.div variants={fadeUp(0)} className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-4 py-1.5 w-fit shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <span className="text-slate-700 text-xs font-bold tracking-wide uppercase">Live · Secure · Family Ecosystem</span>
            </motion.div>

            {/* Heading — clip-reveal per line */}
            <div className="flex flex-col gap-2 overflow-hidden">
              <motion.h1
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]"
                variants={clipReveal(0.1)}
              >
                Care that connects
              </motion.h1>
              <motion.div variants={clipReveal(0.22)}>
                <span className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent drop-shadow-sm">
                  every family.
                </span>
              </motion.div>
            </div>

            {/* Description */}
            <motion.p variants={fadeUp(0.3)} className="text-slate-600 text-lg sm:text-xl leading-relaxed font-medium">
              CareConnect gives elderly loved ones a digital safety net and gives families real-time peace of mind —
              emergency alerts, medication reminders, and daily check-ins, all in one simplified interface.
            </motion.p>

            {/* CTA buttons */}
            <motion.div variants={fadeUp(0.4)} className="flex flex-col sm:flex-row gap-4.5">
              <motion.button
                onClick={() => onOpenAuth('signup')}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-center justify-center gap-2.5 px-8 py-4.5 rounded-2xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-[0_15px_30px_rgba(79,70,229,0.2)] transition-all text-base"
              >
                Start Free Today
                <ArrowRightIcon size={18} className="group-hover:translate-x-1 transition-transform duration-200" />
              </motion.button>

              <motion.button
                onClick={() => onOpenAuth('login')}
                whileHover={{ scale: 1.02, bg: '#f1f5f9' }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center px-8 py-4.5 rounded-2xl font-bold text-slate-700 border border-slate-200 bg-slate-50 transition-all text-base shadow-sm"
              >
                Log In
              </motion.button>
            </motion.div>

            {/* Subtext */}
            <motion.p variants={fadeUp(0.5)} className="text-slate-400 text-xs font-semibold tracking-wide uppercase">
              No credit card required · Free platform setup · Instant verification
            </motion.p>
          </motion.div>

          {/* Right Side: High-Quality Family Interaction Image */}
          <motion.div 
            className="lg:col-span-5 hidden lg:block relative"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl" />
            <div className="relative rounded-[2rem] overflow-hidden border border-slate-200/80 shadow-xl bg-white aspect-[4/3] max-h-[440px]">
              <img 
                src="https://plus.unsplash.com/premium_photo-1661340986594-afd7deb5882e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTN8fGVsZGVybHklMjBjYXJlfGVufDB8fDB8fHww" 
                alt="Happy family staying connected through digital healthcare application" 
                className="w-full h-full object-cover filter contrast-[1.01]"
              />
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-24 px-4 sm:px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col gap-14">

          {/* Section heading */}
          <motion.div
            className="text-center flex flex-col gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp()}
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Up and running in three steps.</h2>
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
                whileHover={{ y: -5, borderColor: 'rgba(99,102,241,0.25)', boxShadow: '0 12px 30px -10px rgba(99,102,241,0.08)' }}
                className="flex flex-col gap-3.5 p-7 rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 relative"
              >
                <span className="text-4xl font-black bg-gradient-to-br from-indigo-600 to-violet-500 bg-clip-text text-transparent tracking-tight">
                  {step}
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="bg-white py-24 px-4 sm:px-6 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col gap-16">

          {/* Section heading */}
          <motion.div
            className="text-center flex flex-col gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp()}
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-indigo-600">Why CareConnect</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything your family needs,<br className="hidden sm:block" /> in one simple app.
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto font-medium mt-1">
              Designed for elderly users who need simplicity and families who need clarity.
            </p>
          </motion.div>

          {/* Feature cards — staggered scroll reveal */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
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
                  y: -6,
                  scale: 1.015,
                  boxShadow: '0 16px 35px -10px rgba(99,102,241,0.08)',
                  borderColor: 'rgba(99,102,241,0.2)',
                }}
                whileTap={{ scale: 0.99 }}
                className="group flex flex-col gap-5 p-7 rounded-3xl border border-slate-200 bg-white hover:bg-slate-50/40 cursor-default transition-all duration-300"
              >
                {/* Icon — micro-interaction: scale + color shift on card hover */}
                <motion.div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${f.color} ${f.iconHover} border border-transparent`}
                  whileHover={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 0.35 }}
                >
                  {f.icon}
                </motion.div>

                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg mb-1.5 tracking-tight group-hover:text-indigo-600 transition-colors">{f.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 py-28 px-4 sm:px-6 relative overflow-hidden">
        
        {/* Abstract structural overlay inside background to enhance aesthetic */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:3rem_3rem]" aria-hidden="true" />
        
        <motion.div
          className="max-w-2xl mx-auto text-center flex flex-col gap-6 relative z-10"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger(0.15)}
        >
          <motion.h2 variants={fadeUp()} className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.2]">
            Give your family the gift of safety.
          </motion.h2>
          <motion.p variants={fadeUp(0.1)} className="text-indigo-100 text-lg font-medium max-w-xl mx-auto">
            Set up CareConnect in minutes and start monitoring what matters most with absolute cloud reliability.
          </motion.p>
          <motion.div variants={fadeUp(0.2)} className="mt-2">
            <motion.button
              onClick={() => onOpenAuth('signup')}
              whileHover={{ scale: 1.03, y: -2, boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }}
              whileTap={{ scale: 0.97 }}
              className="group inline-flex items-center justify-center gap-2.5 mx-auto px-9 py-4.5 rounded-2xl font-extrabold text-indigo-700 bg-white hover:bg-indigo-50 transition-all text-base shadow-md"
            >
              Create Your Care Circle
              <ArrowRightIcon size={18} className="group-hover:translate-x-1 transition-transform duration-200" />
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-10 px-4 text-center border-t border-slate-800">
        <p className="text-slate-500 text-xs font-semibold tracking-wide uppercase">
          © {new Date().getFullYear()} CareConnect · Built with care for family safety and ecosystem resilience
        </p>
      </footer>
    </div>
  )
}