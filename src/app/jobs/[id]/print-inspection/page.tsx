'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { fmt, getSellPrice, DEFAULT_SETTINGS, type ShopSettings } from '@/lib/markup'

const TIRE_KEYS = ['LF (Left Front)','RF (Right Front)','LR (Left Rear)','RR (Right Rear)','Spare','LF (Steer)','RF (Steer)','1LRO','1LRI','1RRI','1RRO','2LRO','2LRI','2RRI','2RRO','3LRO','3LRI','3RRI','3RRO']

export default function InspectionPrintPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [loading,      setLoading]  = useState(true)
  const [job,          setJob]      = useState<any>(null)
  const [inspection,   setInsp]     = useState<any>({})
  const [recommendations, setRecs]  = useState<any>({})
  const [settings,     setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [custType,     setCustType] = useState<'retail'|'commercial'>('retail')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: job }, { data: insp }, { data: s }] = await Promise.all([
        supabase.from('jobs').select('*, vehicles(*, customers(*))').eq('id', id).single(),
        supabase.from('inspections').select('checklist,recommendations').eq('job_id', id).single(),
        supabase.from('shop_settings').select('*').eq('id', 1).single(),
      ])
      if (!job) { router.push('/dashboard'); return }
      setJob(job)
      setSettings(s || DEFAULT_SETTINGS)
      setCustType((job.vehicles?.customers?.customer_type || 'retail') as 'retail'|'commercial')
      setInsp(insp?.checklist || {})
      setRecs(insp?.recommendations || {})
      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) return <div className="p-10 bg-white text-black">Loading Report...</div>

  const allKeys       = Object.keys(inspection)
  const tireItems     = allKeys.filter(k => TIRE_KEYS.includes(k))
  const generalItems  = allKeys.filter(k => !TIRE_KEYS.includes(k))
  const generalFails  = generalItems.filter(k => inspection[k].status === 'fail')
  const generalPass   = generalItems.filter(k => inspection[k].status === 'pass')
  const tireFails     = tireItems.filter(k => inspection[k].status === 'fail')
  const allFails      = [...generalFails, ...tireFails]

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0 flex flex-col">
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded shadow-lg">
        <span className="font-bold text-amber-500">INSPECTION REPORT PREVIEW</span>
        <div className="flex gap-3">
          <Link href={`/jobs/${id}`} className="px-4 py-2 text-slate-300 border border-slate-700 rounded text-sm">← Back</Link>
          <button onClick={()=>window.print()} className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded text-sm">🖨️ Print</button>
        </div>
      </div>

      <div className="flex-grow">
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Heavy Haul <span className="text-amber-600">Auto Service</span> LLC</h1>
            <h2 className="text-xl font-bold text-slate-500 uppercase mt-1">Vehicle Health Report</h2>
            <p className="text-sm font-bold text-slate-700 mt-2">P.O. Box 4742, Carmel, IN 46082 · 463-777-4429</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Date: {new Date().toLocaleDateString()}</p>
            <p>Ticket #: {job.id.slice(0,8)}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg mb-8 border border-slate-200 grid grid-cols-2 gap-8 print:bg-transparent print:border-slate-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</p>
            <p className="font-bold text-lg">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            {job.vehicles.customers.company_name && <p className="text-slate-600">{job.vehicles.customers.company_name}</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Vehicle</p>
            <p className="font-bold text-lg">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <div className="flex gap-4 mt-1 flex-wrap text-sm">
              <p className="font-mono text-slate-600"><span className="text-slate-400">VIN:</span> {job.vehicles.vin||'N/A'}</p>
              <p className="text-slate-600"><span className="text-slate-400">Unit:</span> {job.vehicles.unit_number||'N/A'}</p>
              {job.odometer && <p className="font-mono text-slate-600"><span className="text-slate-400">ODO:</span> {Number(job.odometer).toLocaleString()} mi</p>}
            </div>
          </div>
        </div>

        {allFails.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 text-red-600 border-b border-red-200 pb-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-xl font-bold uppercase">Action Required</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {allFails.map(item => {
                const rec = recommendations[item] || {}
                const isFree = rec.noCost === true
                const pSell  = getSellPrice(Number(rec.parts)||0, custType, settings)
                const total  = Math.round((pSell + (Number(rec.labor)||0)) * 100) / 100
                const hasQ   = total > 0 || isFree
                return (
                  <div key={item} className="p-4 bg-red-50 border border-red-100 rounded print:border-red-300 break-inside-avoid">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg text-red-900">{item}</span>
                      <span className="px-3 py-1 bg-red-200 text-red-800 text-xs font-bold uppercase rounded">Failed</span>
                    </div>
                    {inspection[item].note && <p className="mt-2 text-sm text-red-800 italic">Issue: "{inspection[item].note}"</p>}
                    {hasQ && (
                      <div className="mt-3 pt-3 border-t border-red-200 flex justify-between items-end">
                        <div>
                          <p className="text-xs font-bold text-red-400 uppercase">Recommended Fix</p>
                          <p className="font-bold text-slate-700">{rec.service}</p>
                          {!isFree && <p className="text-xs text-slate-500 mt-1">Parts: {fmt(pSell)} · Labor: {fmt(rec.labor)}</p>}
                        </div>
                        <div className="text-right">
                          {isFree ? <span className="text-green-600 font-bold uppercase text-sm">Complimentary</span>
                                  : <span className="text-slate-900 font-bold text-lg">Est: {fmt(total)}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {generalPass.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 text-green-700 border-b border-green-200 pb-2">
              <span className="text-2xl">✅</span><h3 className="text-xl font-bold uppercase">Passed Items</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {generalPass.map(item=><div key={item} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100"><span className="text-green-500">✓</span><span className="text-sm">{item}</span></div>)}
            </div>
          </div>
        )}

        {tireItems.length > 0 && (
          <div className="break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <span className="text-2xl">🛞</span><h3 className="text-xl font-bold uppercase">Tire Report</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tireItems.map(item=>(
                <div key={item} className="p-3 border border-slate-200 rounded flex justify-between items-center">
                  <div><p className="font-bold font-mono text-sm">{item}</p><p className="text-xs text-slate-500">{inspection[item].note||'No data'}</p></div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${inspection[item].status==='pass'?'bg-green-100 text-green-700':inspection[item].status==='fail'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-500'}`}>
                    {inspection[item].status==='pass'?'OK':inspection[item].status==='fail'?'BAD':'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-slate-300 text-center text-sm text-slate-400 print:mt-4">
        <p>Heavy Haul Auto Service LLC · P.O. Box 4742, Carmel, IN 46082 · 463-777-4429</p>
      </div>
    </div>
  )
}
