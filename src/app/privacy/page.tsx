import React from 'react';

export default function PrivacyPolicy() {
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

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-amber-500 font-medium pb-8 border-b border-slate-800 mb-8">Last Updated: March 2026</p>

        <section className="space-y-6 leading-relaxed text-lg">
          
          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Introduction</h2>
            <p>
              Heavy Haul Auto Service LLC respects your privacy and is committed to protecting your personal data. 
              This Privacy Policy explains how we collect, use, and safeguard your information when you use our services or website.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when requesting service, estimates, or communicating with our shop. 
              This may include your name, phone number, email address, vehicle information, and service history.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>Provide vehicle repair estimates, digital inspections, and invoices.</li>
              <li>Communicate with you regarding the status of your vehicle.</li>
              <li>Respond to your customer service requests.</li>
            </ul>
          </div>

          {/* CRITICAL SECTION FOR TWILIO APPROVAL */}
          <div className="bg-slate-900/80 border-l-4 border-amber-500 p-6 my-10 rounded-r-xl shadow-lg">
            <h2 className="text-xl font-bold text-amber-400 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <path d="m9 11 3 3L22 4"/>
              </svg>
              4. Information Sharing and SMS Consent
            </h2>
            <p className="text-amber-50/90 font-medium leading-relaxed">
              We do not sell, rent, or trade your personal information. No mobile information will be shared with 
              third parties or affiliates for marketing or promotional purposes. All the above categories exclude 
              text messaging originator opt-in data and consent; this information will not be shared with any third parties.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Data Security</h2>
            <p>
              We implement standard security measures to protect your personal information from unauthorized access, 
              alteration, or disclosure.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@heavyhaulautoservice.com 
              or call our main office.
            </p>
          </div>

        </section>
      </div>
    </div>
  );
}