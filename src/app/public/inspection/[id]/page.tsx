'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import { fmt, getSellPrice, DEFAULT_SETTINGS, type ShopSettings } from '@/lib/markup'

const TIRE_KEYS = ['LF (Left Front)','RF (Right Front)','LR (Left Rear)','RR (Right Rear)','Spare','LF (Steer)','RF (Steer)','1LRO','1LRI','1RRI','1RRO','2LRO','2LRI','2RRI','2RRO','3LRO','3LRI','3RRI','3RRO']

export default function PublicInspectionPage() {
  const { id } = useParams()
  const [loading,  setLoading]        = useState(true)
  const [job,      setJob]            = useState<any>(null)
  const [inspection,setInspection]    = useState<any>({})
  const [recommendations,setRecs]     = useState<any>({})
  const [settings, setSettings]       = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [custType, setCustType]       = useState<'retail'|'commercial'>('retail')

  useEffect(() => {
    const load = async () => {
      const [{ data: job }, { data: insp }, { data: s }] = await Promise.all([
        supabase.from('jobs').select('*, vehicles(*, customers(*))').eq('id', id).single(),
        supabase.from('inspections').select('checklist,recommendations').eq('job_id', id).single(),
        supabase.from('shop_settings').select('*').eq('id', 1).single(),
      ])
      if (job) {
        setJob(job)
        setSettings(s || DEFAULT_SETTINGS)
        setCustType((job.vehicles?.customers?.customer_type || 'retail') as 'retail'|'commercial')
        setInspection(insp?.checklist || {})
        setRecs(insp?.recommendations || {})
      }
      setLoading(false)
    }
    load()
  }, [id])

  const approve = async (item: string, decision: 'approved'|'denied') => {
    const updated = { ...recommendations, [item]: { ...recommendations[item], decision } }
    setRecs(updated)
    await supabase.from('inspections').update({ recommendations: updated }).eq('job_id', id)
  }

  if (loading) return <div className="p-10 text-center bg-white text-slate-500">Loading Report...</div>
  if (!job)    return <div className="p-10 text-center bg-white text-slate-500">Report not found.</div>

  const allKeys     = Object.keys(inspection)
  const tireItems   = allKeys.filter(k => TIRE_KEYS.includes(k))
  const generalItems = allKeys.filter(k => !TIRE_KEYS.includes(k))
  const failItems   = allKeys.filter(k => inspection[k].status === 'fail')
  const passGeneral = generalItems.filter(k => inspection[k].status === 'pass')

  // Approved total with markup applied
  let approvedTotal = 0
  for (const key of allKeys) {
    const rec = recommendations[key]
    if (!rec || rec.decision !== 'approved') continue
    if (rec.noCost) continue
    const pSell = getSellPrice(Number(rec.parts)||0, custType, settings)
    approvedTotal += Math.round((pSell + (Number(rec.labor)||0)) * 100)
  }
  approvedTotal = approvedTotal / 100

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      <div className="bg-slate-900 text-white p-6 text-center shadow-lg">
        <h1 className="text-2xl font-black uppercase tracking-tighter">Heavy Haul <span className="text-amber-500">Auto Service</span> LLC</h1>
        <a href="tel:463-777-4429" className="block mt-2 text-amber-500 font-bold text-lg">📞 463-777-4429</a>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div><h2 className="font-bold text-xl">{job.vehicles.year} {job.vehicles.make}</h2><p className="text-slate-500">{job.vehicles.model}</p></div>
            <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${job.status==='ready'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}`}>{job.status.replace('_',' ')}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs font-bold text-slate-400 uppercase block">VIN</span><span className="font-mono">{job.vehicles.vin?.slice(-6)||'N/A'}</span></div>
            <div><span className="text-xs font-bold text-slate-400 uppercase block">Unit</span><span className="font-mono">{job.vehicles.unit_number||'N/A'}</span></div>
          </div>
        </div>

        {failItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-red-200 pb-2 text-red-600">
              <span className="text-xl">⚠️</span><h3 className="text-lg font-bold uppercase">Action Required</h3>
            </div>
            {failItems.map(item => {
              const rec = recommendations[item] || {}
              const isFree = rec.noCost === true
              const pSell = getSellPrice(Number(rec.parts)||0, custType, settings)
              const totalCost = Math.round((pSell + (Number(rec.labor)||0)) * 100) / 100
              const hasQuote = totalCost > 0 || isFree
              return (
                <div key={item} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${rec.decision==='approved'?'border-green-500 shadow-green-100':rec.decision==='denied'?'border-slate-200 opacity-75':'border-red-100'}`}>
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg text-slate-800">{item}</h4>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">FAILED</span>
                    </div>
                    {inspection[item].note && <p className="text-red-600 text-sm mt-1 italic">"{inspection[item].note}"</p>}
                  </div>
                  {hasQuote ? (
                    <div className="p-4">
                      <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Recommended Service</p>
                        <p className="font-medium text-slate-800">{rec.service||'Repair Required'}</p>
                      </div>
                      <div className="flex justify-between items-end mb-4 border-b border-dashed border-slate-200 pb-4">
                        {isFree ? (
                          <div className="w-full">
                            <span className="block text-xs font-bold text-green-600 uppercase mb-1">Cost to you:</span>
                            <span className="text-2xl font-black text-green-500">COMPLIMENTARY</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-slate-500">
                              <p>Parts: {fmt(pSell)}</p>
                              <p>Labor: {fmt(rec.labor)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase">Est. Cost</p>
                              <p className="text-2xl font-black text-slate-900">{fmt(totalCost)}</p>
                            </div>
                          </>
                        )}
                      </div>
                      {rec.decision==='approved' ? (
                        <div className="bg-green-50 text-green-700 font-bold text-center py-3 rounded-lg border border-green-200">✅ WORK APPROVED</div>
                      ) : rec.decision==='denied' ? (
                        <div className="bg-slate-100 text-slate-500 font-bold text-center py-3 rounded-lg">❌ WORK DECLINED</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={()=>approve(item,'denied')} className="py-3 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-lg">Decline</button>
                          <button onClick={()=>approve(item,'approved')} className={`py-3 text-white font-bold rounded-lg shadow-lg ${isFree?'bg-indigo-500':'bg-green-500'}`}>{isFree?'Accept Free Service':'Approve Repair'}</button>
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

        {tireItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center gap-2"><span className="text-xl">🛞</span><h3 className="font-bold">Tire Health Report</h3></div>
            <div className="divide-y divide-slate-100">
              {tireItems.map(item=>(
                <div key={item} className="p-3 flex justify-between items-center">
                  <div><span className="text-sm font-bold block">{item}</span><span className="text-xs font-mono text-slate-500">{inspection[item].note||'No data'}</span></div>
                  <div>
                    {inspection[item].status==='pass'&&<span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">GOOD</span>}
                    {inspection[item].status==='fail'&&<span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">BAD</span>}
                    {inspection[item].status==='na'&&<span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">N/A</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden mt-6">
          <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-2"><span className="text-xl">✅</span><h3 className="font-bold text-green-900">Passed Items</h3></div>
          <div className="p-4 space-y-2">
            {passGeneral.map(item=><div key={item} className="flex justify-between items-center"><span className="text-slate-600">{item}</span><span className="text-green-500 text-lg">✓</span></div>)}
            {passGeneral.length===0&&<p className="text-slate-400 text-center text-sm">No items marked as passed.</p>}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-slate-900 text-white p-4 border-t border-slate-800 shadow-2xl z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold">Approved Total</p>
            <p className="text-2xl font-black text-amber-500">{fmt(approvedTotal)}</p>
          </div>
          <button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} className="px-4 py-2 bg-slate-800 rounded text-sm font-bold text-slate-300 border border-slate-700">Review ↑</button>
        </div>
      </div>
    </div>
  )
}
