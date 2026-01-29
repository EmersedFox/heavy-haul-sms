'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

// Define Tire Lists to separate them from General Items
const TIRE_KEYS = [
  'LF (Left Front)', 'RF (Right Front)', 'LR (Left Rear)', 'RR (Right Rear)', 'Spare',
  'LF (Steer)', 'RF (Steer)', 
  '1LRO', '1LRI', '1RRI', '1RRO', 
  '2LRO', '2LRI', '2RRI', '2RRO', 
  '3LRO', '3LRI', '3RRI', '3RRO'
]

export default function InspectionPrintPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  const [inspection, setInspection] = useState<any>({})
  const [recommendations, setRecommendations] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      // 1. SECURITY CHECK
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // 2. Fetch Data
      const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
      const { data: inspData } = await supabase.from('inspections').select('checklist, recommendations').eq('job_id', id).single()

      if (!jobData) { router.push('/dashboard'); return }

      setJob(jobData)
      setInspection(inspData?.checklist || {})
      setRecommendations(inspData?.recommendations || {})
      setLoading(false)
    }
    fetchData()
  }, [id, router])

  if (loading) return <div className="p-10 bg-white text-black font-sans">Loading Report...</div>

  // --- FILTERS ---
  const allKeys = Object.keys(inspection)
  
  // 1. Separate Tires from General
  const tireItems = allKeys.filter(key => TIRE_KEYS.includes(key))
  const generalItems = allKeys.filter(key => !TIRE_KEYS.includes(key))

  // 2. Filter Failures (General Only - Tires handled in Tire Section)
  const generalFailures = generalItems.filter(key => inspection[key].status === 'fail')
  const generalPass = generalItems.filter(key => inspection[key].status === 'pass')

  // 3. Filter Tire Failures for the "Action Required" box
  const tireFailures = tireItems.filter(key => inspection[key].status === 'fail')

  const allFailures = [...generalFailures, ...tireFailures]

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0 flex flex-col">
      
      {/* NO-PRINT CONTROLS */}
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded shadow-lg">
        <div className="font-bold text-amber-500">INSPECTION REPORT PREVIEW</div>
        <div className="flex gap-4">
          <Link href={`/jobs/${id}`} className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 rounded transition-colors">← Back to Ticket</Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded transition-colors">
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* REPORT CONTENT */}
      <div className="flex-grow">
        
        {/* HEADER */}
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Heavy Haul <span className="text-amber-600">Auto Service</span> LLC
            </h1>
            <h2 className="text-xl font-bold text-slate-500 uppercase mt-1">Vehicle Health Report</h2>
            <div className="mt-2 text-sm font-bold text-slate-800">
               <p>P.O. Box 4742, Carmel, IN 46082</p>
               <p>463-777-4429</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Date: {new Date().toLocaleDateString()}</p>
            <p>Ticket #: {job.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* VEHICLE INFO */}
        <div className="bg-slate-100 p-6 rounded-lg mb-8 border border-slate-200 grid grid-cols-2 gap-8 print:bg-transparent print:border-slate-300">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</h3>
            <p className="font-bold text-lg">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            <p className="text-slate-600">{job.vehicles.customers.company_name}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Vehicle</h3>
            <p className="font-bold text-lg">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <div className="flex gap-4 mt-1">
               <p className="font-mono text-slate-600 text-sm"><span className="text-slate-400">VIN:</span> {job.vehicles.vin || 'N/A'}</p>
               <p className="text-slate-600 text-sm"><span className="text-slate-400">Unit:</span> {job.vehicles.unit_number || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* SECTION 1: ACTION REQUIRED (Failures + Quotes) */}
        {allFailures.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 text-red-600 border-b border-red-200 pb-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-xl font-bold uppercase">Action Required</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {allFailures.map(item => {
                const rec = recommendations[item] || {}
                const hasQuote = (rec.parts || 0) + (rec.labor || 0) > 0 || rec.noCost === true

                return (
                  <div key={item} className="p-4 bg-red-50 border border-red-100 rounded print:border-red-300 break-inside-avoid">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg text-red-900">{item}</span>
                      <span className="px-3 py-1 bg-red-200 text-red-800 text-xs font-bold uppercase rounded print:border print:border-red-800">Failed</span>
                    </div>
                    
                    {/* Failure Note */}
                    {inspection[item].note && (
                       <div className="mt-2 text-sm text-red-800 italic">
                         Issue: "{inspection[item].note}"
                       </div>
                    )}

                    {/* Advisor Quote Display */}
                    {hasQuote && (
                      <div className="mt-3 pt-3 border-t border-red-200 flex justify-between items-end">
                        <div>
                          <p className="text-xs font-bold text-red-400 uppercase">Recommended Fix</p>
                          <p className="font-bold text-slate-700">{rec.service}</p>
                        </div>
                        <div className="text-right">
                          {rec.noCost ? (
                             <span className="text-green-600 font-bold uppercase text-sm">Complimentary</span>
                          ) : (
                             <span className="text-slate-900 font-bold">Est: ${((rec.parts || 0) + (rec.labor || 0)).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION 2: TIRE HEALTH REPORT (All Tires + Measurements) */}
        {tireItems.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 text-slate-700 border-b border-slate-200 pb-2">
              <span className="text-2xl">🛞</span>
              <h3 className="text-xl font-bold uppercase">Tire Health Report</h3>
            </div>
            
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-500 uppercase text-xs">
                  <th className="p-2 text-left border border-slate-300">Position</th>
                  <th className="p-2 text-center border border-slate-300 w-24">Status</th>
                  <th className="p-2 text-left border border-slate-300">Tread Depth / PSI / Notes</th>
                </tr>
              </thead>
              <tbody>
                {tireItems.map(item => (
                  <tr key={item} className="border border-slate-300">
                    <td className="p-2 font-bold text-slate-800">{item}</td>
                    <td className="p-2 text-center">
                      {inspection[item].status === 'pass' && <span className="text-green-700 font-bold">OK</span>}
                      {inspection[item].status === 'fail' && <span className="text-red-600 font-bold">BAD</span>}
                      {inspection[item].status === 'na' && <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="p-2 font-mono text-slate-600">
                      {inspection[item].note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 3: PASSED GENERAL ITEMS */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-green-600 border-b border-green-200 pb-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-xl font-bold uppercase">General Passed Items</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 print:grid-cols-2">
            {generalPass.map(item => (
              <div key={item} className="flex justify-between items-center py-2 border-b border-slate-100 print:border-slate-200 break-inside-avoid">
                <span className="text-slate-700 font-medium">{item}</span>
                <span className="text-green-700 text-xs font-bold uppercase tracking-wider">OK</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-400">
        <p>Heavy Haul Auto Service LLC • P.O. Box 4742, Carmel, IN 46082</p>
        <p className="italic mt-1 text-xs">This report is a visual inspection only and does not guarantee internal component condition.</p>
      </div>

    </div>
  )
}