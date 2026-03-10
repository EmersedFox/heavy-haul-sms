import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-slate-900">

      {/* NAV */}
      <nav className="border-b border-slate-800/60 px-6 py-4 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur z-30">
        <div className="relative h-12 w-48 md:w-64">
          <Image src="/cover.png" alt="Heavy Haul Auto Service" fill className="object-contain object-left" priority />
        </div>
        <a href="tel:4637774429" className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-all text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5">
          Call Now
        </a>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,158,11,0.12),_transparent_60%)]" />
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Indianapolis &amp; Carmel
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6">
            HEAVY HAUL{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              AUTO SERVICE
            </span>
          </h1>
          <p className="text-slate-400 text-xl mb-10 max-w-2xl leading-relaxed">
            We specialize in heavy-duty repair, fleet maintenance, and 24/7 towing recovery. Trusted by owner-operators and fleets across central Indiana.
          </p>
          <div className="flex gap-4 flex-wrap">
            <a href="tel:4637774429" className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl text-lg transition-all shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5">
              Request Towing
            </a>
            <a href="#services" className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-lg transition-colors">
              View Services
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold mb-12 text-center border-b border-slate-800 pb-4">Our Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🚛',
              title: 'Heavy Duty Repair',
              desc: 'Diesel engine diagnostics, air brake systems, and driveline repair for semis and fleet vehicles.',
            },
            {
              icon: '🔧',
              title: 'Auto & Light Truck',
              desc: 'Standard maintenance, suspension work, and engine repair for passenger vehicles and light duty trucks.',
            },
            {
              icon: '🪝',
              title: 'Towing & Recovery',
              desc: '24/7 Emergency response for breakdowns, accidents, and vehicle transport in the Indy area.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-colors"
            >
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-6 text-2xl">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Heavy Haul Auto Service LLC. All rights reserved.
          </div>
          <div className="flex gap-6 items-center">
            <a href="/privacy" className="hover:text-amber-500 transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-amber-500 transition-colors">
              Terms &amp; Conditions
            </a>

            {/* Staff login — subtle */}
            <a
              href="/login"
              className="hover:text-amber-500 transition-colors flex items-center gap-1 ml-4 border-l border-slate-800 pl-6"
            >
              <span className="w-2 h-2 bg-slate-800 rounded-full" /> Staff Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}