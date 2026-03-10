'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import { fmt, getSellPrice, computeTotals, DEFAULT_SETTINGS, type ShopSettings } from '@/lib/markup'

const SHOP = { name:'Heavy Haul Auto Service LLC', address:'P.O. Box 4742, Carmel, IN 46082', phone:'463-777-4429' }

export default function PublicInvoicePage() {
  const { id } = useParams()
  const [loading,  setLoading]  = useState(true)
  const [job,      setJob]      = useState<any>(null)
  const [lines,    setLines]    = useState<any[]>([])
  const [totals,   setTotals]   = useState({ partsTotal:0, laborTotal:0, taxAmt:0, grandTotal:0 })
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [custType, setCustType] = useState<'retail'|'commercial'>('retail')

  useEffect(() => {
    async function load() {
      const [{ data: job }, { data: insp }, { data: s }] = await Promise.all([
        supabase.from('jobs').select('*, vehicles(*, customers(*))').eq('id', id).single(),
        supabase.from('inspections').select('recommendations').eq('job_id', id).single(),
        supabase.from('shop_settings').select('*').eq('id', 1).single(),
      ])
      if (!job) { setLoading(false); return }
      const ss: ShopSettings = s || DEFAULT_SETTINGS
      const ct = (job.vehicles?.customers?.customer_type || 'retail') as 'retail'|'commercial'
      setJob(job); setSettings(ss); setCustType(ct)
      const recs = insp?.recommendations
      let serviceLines: any[] = []
      if (recs?.service_lines) serviceLines = recs.service_lines
      else if (recs) serviceLines = Object.values(recs).filter((r:any)=>r.decision==='approved').map((r:any,i:number)=>({ id:i, title:r.service||'Service', labor:r.labor?[{desc:'Labor',hours:1,rate:Number(r.labor)}]:[], parts:r.parts?[{name:'Parts',qty:1,price:Number(r.parts),partNumber:''}]:[] }))
      setLines(serviceLines)
      setTotals(computeTotals(serviceLines, ct, ss))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Invoice...</div>
  if (!job)    return <div className="p-10 text-center text-red-500">Invoice not found.</div>

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 font-sans text-slate-900 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-0">
        <div className="bg-slate-900 text-white p-8 flex justify-between items-center print:bg-white print:text-black print:border-b-4 print:border-slate-900">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-amber-500 print:text-slate-900">Invoice</h1>
            <p className="text-slate-400 text-sm print:text-slate-600">#{job.id.slice(0,8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-lg">{SHOP.name}</h2>
            <p className="text-sm text-slate-400 print:text-slate-600">{SHOP.address}</p>
            <p className="text-sm text-slate-400 print:text-slate-600">{SHOP.phone}</p>
          </div>
        </div>

        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To</p>
            <p className="font-bold text-xl">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            {job.vehicles.customers.company_name && <p className="text-slate-500">{job.vehicles.customers.company_name}</p>}
            <p className="text-slate-500 text-sm">{job.vehicles.customers.phone}</p>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Vehicle</p>
            <p className="font-bold text-xl">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <p className="text-slate-500 font-mono text-sm">VIN: {job.vehicles.vin}</p>
            {job.vehicles.unit_number && <p className="text-xs bg-slate-100 inline-block px-2 py-1 rounded mt-1 border border-slate-200">Unit #{job.vehicles.unit_number}</p>}
            {job.odometer && <p className="text-slate-500 font-mono text-sm mt-1">ODO: {Number(job.odometer).toLocaleString()} mi</p>}
          </div>
        </div>

        <div className="p-8">
          <p className="text-xs font-bold text-slate-400 uppercase mb-4 border-b border-slate-200 pb-2">Services Performed</p>
          <div className="space-y-5">
            {lines.map((line, idx) => {
              const lAmt = (line.labor||[]).reduce((a:number,l:any)=>a+(Number(l.hours)||0)*(Number(l.rate)||0),0)
              const pAmt = (line.parts||[]).reduce((a:number,p:any)=>a+(Number(p.qty)||0)*getSellPrice(Number(p.price)||0,custType,settings),0)
              return (
                <div key={line.id??idx} className="border-b border-slate-100 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-lg"><span className="text-amber-600 text-sm mr-2">{idx+1}.</span>{line.title}</p>
                    <p className="font-bold text-slate-900 text-lg">{fmt(lAmt+pAmt)}</p>
                  </div>
                  <div className="pl-5 space-y-1">
                    {(line.labor||[]).map((l:any,i:number)=><div key={`l-${i}`} className="flex justify-between text-sm text-slate-500"><span>Labor: {l.desc} <span className="text-xs">({l.hours}h)</span></span><span>{fmt(Number(l.hours)*Number(l.rate))}</span></div>)}
                    {(line.parts||[]).map((p:any,i:number)=>{const sell=getSellPrice(Number(p.price)||0,custType,settings);return(<div key={`p-${i}`} className="flex justify-between text-sm text-slate-500"><span>Part: {p.name} <span className="text-xs">(×{p.qty})</span></span><span>{fmt(Number(p.qty)*sell)}</span></div>)})}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-slate-50 p-8 border-t border-slate-200 print:bg-white">
          <div className="flex justify-end">
            <div className="w-full md:w-1/2 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between border-b border-slate-200 pb-2"><span>Labor</span><span>{fmt(totals.laborTotal)}</span></div>
              <div className="flex justify-between border-b border-slate-200 pb-2"><span>Parts</span><span>{fmt(totals.partsTotal)}</span></div>
              <div className="flex justify-between border-b border-slate-200 pb-2"><span>Tax ({settings.tax_rate}%)</span><span>{fmt(totals.taxAmt)}</span></div>
              <div className="flex justify-between text-slate-900 text-2xl font-bold pt-2"><span>Total Due</span><span className="text-amber-600">{fmt(totals.grandTotal)}</span></div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 text-center print:hidden">
          <button onClick={()=>window.print()} className="text-white font-bold text-sm w-full py-2 hover:text-amber-500">🖨️ Print / Save as PDF</button>
        </div>
      </div>
      <p className="text-center mt-4 text-slate-400 text-xs print:hidden">Thank you for choosing Heavy Haul Auto Service.</p>
    </div>
  )
}
