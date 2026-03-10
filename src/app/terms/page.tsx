import React from 'react';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-amber-500 selection:text-slate-900 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        <a href="/" className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 font-medium mb-12 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg> 
          Back to Home
        </a>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Terms & Conditions</h1>
        <p className="text-amber-500 font-medium pb-8 border-b border-slate-800 mb-8">Last Updated: March 2026</p>

        <section className="space-y-6 leading-relaxed text-lg">
          
          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Agreement to Terms</h2>
            <p>
              By accessing our website or utilizing the services of Heavy Haul Auto Service LLC, you agree to be bound 
              by these Terms and Conditions.
            </p>
          </div>

          {/* SMS TERMS REQUIRED BY CARRIERS */}
      <div className="bg-slate-900/80 border-l-4 border-amber-500 p-6 my-10 rounded-r-xl shadow-lg">
        <h2 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <path d="m9 11 3 3L22 4"/>
          </svg>
          2. SMS Communications & Messaging Terms
        </h2>
        <p className="mb-4 text-amber-50/90">
              By opting in to receive text messages from Heavy Haul Auto Service LLC, you agree to the following terms:
            </p>
            <ul className="list-disc pl-6 space-y-3 text-amber-50/80 text-base">
              <li><strong className="text-amber-200">Program Description:</strong> We use SMS to send transactional updates regarding your vehicle repair status, digital inspections, service estimates, and final invoices.</li>
              <li><strong className="text-amber-200">Message Frequency:</strong> Message frequency varies based on the repair status of your vehicle.</li>
              <li><strong className="text-amber-200">Pricing:</strong> Message and data rates may apply. Check with your mobile carrier for details.</li>
              <li><strong className="text-amber-200">Opt-Out:</strong> You can cancel the SMS service at any time. Simply text "STOP" to our shortcode or phone number. Upon sending "STOP," we will confirm your unsubscribe status via SMS. Following this confirmation, you will no longer receive SMS messages from us. To rejoin, sign up as you did initially.</li>
              <li><strong className="text-amber-200">Help:</strong> If you experience issues with the messaging program, reply with the keyword "HELP" for more assistance, or contact us directly.</li>
              <li><strong className="text-amber-200">Carrier Liability:</strong> Carriers are not liable for delayed or undelivered messages.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Service Authorizations</h2>
            <p>
              By leaving your vehicle at our facility, you authorize Heavy Haul Auto Service to perform the work outlined 
              in the initial estimate. Additional work discovered during inspection will require separate approval before 
              we proceed.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of the State of Indiana, 
              and you irrevocably submit to the exclusive jurisdiction of the courts in that State.
            </p>
          </div>

        </section>
      </div>
    </div>
  );
}