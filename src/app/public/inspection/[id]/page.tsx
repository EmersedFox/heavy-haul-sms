'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

const TIRE_KEYS = [
  'LF (Left Front)', 'RF (Right Front)', 'LR (Left Rear)', 'RR (Right Rear)', 'Spare',
  'LF (Steer)', 'RF (Steer)', 
  '1LRO', '1LRI', '1RRI', '1RRO', 
  '2LRO', '2LRI', '2RRI', '2RRO', 
  '3LRO', '3LRI', '3RRI', '3RRO'
]

export default function PublicInspectionPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  
  // Inspection Data
  const [inspection, setInspection] = useState<any>({})
  const [recommendations, setRecommendations] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Job (Public Read enabled)
      const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
      const { data: inspData } = await supabase.from('inspections').select('checklist, recommendations').eq('job_id', id).single()

      if (jobData) {
        setJob(jobData)
        setInspection(inspData?.checklist || {})
        setRecommendations(inspData?.recommendations || {})
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  // --- ACTIONS ---

  const handleDecision = async (item: string, decision: 'approved' | 'denied') => {
    // 1. Optimistic Update
    const newRecs = {
      ...recommendations,
      [item]: { ...recommendations[item], decision: decision }
    }
    setRecommendations(newRecs)

    // 2. Save to Database
    await supabase.from('inspections').update({ recommendations: newRecs }).eq('job_id', id)
  }

  // --- FILTERS ---

  const allKeys = Object.keys(inspection)
  const tireItems = allKeys.filter(key => TIRE_KEYS.includes(key))
  const generalItems = allKeys.filter(key => !TIRE_KEYS.includes(key))

  // 1. All Failures (Tires + General) go to "Action Required"
  const failItems = allKeys.filter(key => inspection[key].status === 'fail')
  
  // 2. Passed General Items
  const passGeneralItems = generalItems.filter(key => inspection[key].status === 'pass')

  // Calculate Total (Only Approved items)
  const approvedTotal = Object.keys(recommendations).reduce((sum, key) => {
    const rec = recommendations[key]
    if (rec && rec.decision === 'approved') {
      return sum + (rec.parts || 0) + (rec.labor || 0)
    }
    return sum
  }, 0)

  if (loading) return <div className="p-10 text-center bg-white text-slate-500">Loading Report...</div>
  if (!job) return <div className="p-10 text-center bg-white text-slate-500">Report not found.</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      
      {/* MOBILE HEADER */}
      <div className="bg-slate-900 text-white p-6 text-center shadow-lg">
        <h1 className="text-2xl font-black uppercase tracking-tighter">Heavy Haul <span className="text-amber-500">Auto Service</span> LLC</h1>
        <a href="tel:463-777-4429" className="block mt-2 text-amber-500 font-bold text-lg">📞 463-777-4429</a>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* SUMMARY CARD */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-bold text-xl">{job.vehicles.year} {job.vehicles.make}</h2>
              <p className="text-slate-500">{job.vehicles.model}</p>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${job.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {job.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
             <div><span className="text-xs font-bold text-slate-400 uppercase block">VIN</span> <span className="font-mono">{job.vehicles.vin?.slice(-6) || 'N/A'}</span></div>
             <div><span className="text-xs font-bold text-slate-400 uppercase block">Unit</span> <span className="font-mono">{job.vehicles.unit_number || 'N/A'}</span></div>
          </div>
        </div>

        {/* ⚠️ ACTION REQUIRED (Failures + Estimates) */}
        {failItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 text-red-600 border-b border-red-200 pb-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-lg font-bold uppercase">Action Required</h3>
            </div>

            {failItems.map(item => {
              const rec = recommendations[item] || {}
              const totalCost = (rec.parts || 0) + (rec.labor || 0)
              const isFree = rec.noCost === true
              const hasQuote = totalCost > 0 || isFree

              return (
                <div key={item} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${rec.decision === 'approved' ? 'border-green-500 shadow-green-100' : rec.decision === 'denied' ? 'border-slate-200 opacity-75' : 'border-red-100'}`}>
                  
                  {/* Item Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg text-slate-800">{item}</h4>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">FAILED</span>
                    </div>
                    {inspection[item].note && (
                      <p className="text-red-600 text-sm mt-1 italic">"{inspection[item].note}"</p>
                    )}
                  </div>

                  {/* Recommendation Body */}
                  {hasQuote ? (
                    <div className="p-4">
                      <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Recommended Service</p>
                        <p className="font-medium text-slate-800">{rec.service || 'Repair Required'}</p>
                      </div>
                      
                      {/* PRICING */}
                      <div className="flex justify-between items-end mb-4 border-b border-dashed border-slate-200 pb-4">
                        {isFree ? (
                          <div className="w-full">
                            <span className="block text-xs font-bold text-green-600 uppercase mb-1">Cost to you:</span>
                            <div className="flex justify-between items-end w-full">
                               <span className="text-2xl font-black text-green-500 tracking-tight">COMPLIMENTARY</span>
                               <span className="text-sm font-bold text-slate-400 line-through">$0.00</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-slate-500">
                              <p>Parts: ${rec.parts}</p>
                              <p>Labor: ${rec.labor}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase">Est. Cost</p>
                              <p className="text-2xl font-black text-slate-900">${totalCost}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      {rec.decision === 'approved' ? (
                        <div className="bg-green-50 text-green-700 font-bold text-center py-3 rounded-lg border border-green-200">
                          ✅ WORK APPROVED
                        </div>
                      ) : rec.decision === 'denied' ? (
                        <div className="bg-slate-100 text-slate-500 font-bold text-center py-3 rounded-lg">
                          ❌ WORK DECLINED
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => handleDecision(item, 'denied')} className="py-3 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-lg hover:bg-slate-50">Decline</button>
                          <button onClick={() => handleDecision(item, 'approved')} className={`py-3 text-white font-bold rounded-lg shadow-lg ${isFree ? 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-500/30' : 'bg-green-500 hover:bg-green-400 shadow-green-500/30'}`}>
                            {isFree ? 'Accept Free Service' : 'Approve Repair'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500 italic text-sm">Pending estimate...</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 🛞 TIRE HEALTH REPORT (New Section) */}
        {tireItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center gap-2">
              <span className="text-xl">🛞</span>
              <h3 className="font-bold text-slate-800">Tire Health Report</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {tireItems.map(item => (
                <div key={item} className="p-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">{item}</span>
                    <span className="text-xs font-mono text-slate-500">{inspection[item].note || 'No data recorded'}</span>
                  </div>
                  <div className="text-right">
                    {inspection[item].status === 'pass' && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">GOOD</span>}
                    {inspection[item].status === 'fail' && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">BAD</span>}
                    {inspection[item].status === 'na' && <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">N/A</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ PASSED GENERAL ITEMS */}
        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden mt-8">
          <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-2">
            <span className="text-xl">✅</span>
            <h3 className="font-bold text-green-900">General Passed Items</h3>
          </div>
          <div className="p-4 grid grid-cols-1 gap-y-3">
            {passGeneralItems.map(item => (
              <div key={item} className="flex justify-between items-center">
                <span className="text-slate-600">{item}</span>
                <span className="text-green-500 text-lg">✓</span>
              </div>
            ))}
            {passGeneralItems.length === 0 && <p className="text-slate-400 text-center text-sm">No general items marked as Passed.</p>}
          </div>
        </div>

      </div>

      {/* FOOTER - TOTAL CALCULATOR */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900 text-white p-4 border-t border-slate-800 shadow-2xl z-50 safe-area-bottom">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold">Approved Total</p>
            <p className="text-2xl font-black text-amber-500">${approvedTotal.toFixed(2)}</p>
          </div>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
            className="px-4 py-2 bg-slate-800 rounded text-sm font-bold text-slate-300 border border-slate-700"
          >
            Review Items ↑
          </button>
        </div>
      </div>

    </div>
  )
}