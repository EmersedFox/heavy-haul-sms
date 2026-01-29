import Link from 'next/link'
import Image from 'next/image'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-slate-900">
      
      {/* HEADER / NAV */}
      <header className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="relative h-12 w-48">
            <Image 
              src="/cover.png" 
              alt="Heavy Haul Auto Service" 
              fill 
              className="object-contain object-left"
              priority
            />
          </div>
          <a href="tel:4637774429" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-2 rounded-full transition-transform hover:scale-105">
            Call Now
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 px-6 flex flex-col items-center text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-slate-950">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          HEAVY HAUL <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">AUTO SERVICE</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mb-10">
          Serving Indianapolis & Carmel. We specialize in heavy-duty repair, fleet maintenance, and 24/7 towing recovery.
        </p>
        <div className="flex gap-4">
          <a href="tel:4637774429" className="px-8 py-4 bg-amber-500 text-slate-900 font-bold rounded text-lg hover:bg-amber-400 transition-colors">
            Request Towing
          </a>
          <a href="#services" className="px-8 py-4 border border-slate-700 text-white font-bold rounded text-lg hover:bg-slate-800 transition-colors">
            View Services
          </a>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center border-b border-slate-800 pb-4">Our Capabilities</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-colors">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-6 text-2xl">🚛</div>
            <h3 className="text-xl font-bold mb-3">Heavy Duty Repair</h3>
            <p className="text-slate-400">Diesel engine diagnostics, air brake systems, and driveline repair for semis and fleet vehicles.</p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-colors">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-6 text-2xl">🔧</div>
            <h3 className="text-xl font-bold mb-3">Auto & Light Truck</h3>
            <p className="text-slate-400">Standard maintenance, suspension work, and engine repair for passenger vehicles and light duty trucks.</p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-colors">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-6 text-2xl">🪝</div>
            <h3 className="text-xl font-bold mb-3">Towing & Recovery</h3>
            <p className="text-slate-400">24/7 Emergency response for breakdowns, accidents, and vehicle transport in the Indy area.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <div className="mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Heavy Haul Auto Service LLC. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-amber-500 transition-colors">Privacy Policy</a>
            
            {/* THE HIDDEN DOOR */}
            <Link href="/login" className="hover:text-amber-500 transition-colors flex items-center gap-1">
              <span className="w-2 h-2 bg-slate-800 rounded-full"></span> Staff Login
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}