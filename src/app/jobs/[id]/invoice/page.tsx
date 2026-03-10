'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fmt, getSellPrice, computeTotals, DEFAULT_SETTINGS, type ShopSettings } from '@/lib/markup'

export default function InvoicePage() {
  const { id } = useParams()
  const [loading,     setLoading]     = useState(true)
  const [job,         setJob]         = useState<any>(null)
  const [lines,       setLines]       = useState<any[]>([])
  const [totals,      setTotals]      = useState({ partsTotal:0, laborTotal:0, taxAmt:0, grandTotal:0 })
  const [settings,    setSettings]    = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [custType,    setCustType]    = useState<'retail'|'commercial'>('retail')

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

  const copy = () => { navigator.clipboard.writeText(`${window.location.origin}/public/invoice/${id}`); alert('Invoice link copied!') }
  if (loading) return <div className="p-10 text-white bg-slate-950 min-h-screen font-sans">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto mb-8 border-b border-slate-800 pb-6 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Invoice <span className="text-slate-400 font-mono text-xl">#{job.id.slice(0,8)}</span></h1>
          <p className="text-slate-300 mt-1 font-medium">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
          {job.vehicles.customers.company_name && <p className="text-slate-500 text-sm">{job.vehicles.customers.company_name}</p>}
          <p className="text-slate-500 text-sm">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
          {job.odometer && <p className="text-slate-500 text-sm font-mono">ODO: {Number(job.odometer).toLocaleString()} mi</p>}
          <span className={`mt-1 inline-block text-[10px] font-bold border px-2 py-0.5 rounded uppercase ${custType==='commercial'?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-slate-700 text-slate-300 border-slate-600'}`}>{custType}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/jobs/${id}`}><button className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 text-sm">← Back</button></Link>
          <button onClick={copy} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-sm">🔗 Share</button>
          <Link href={`/jobs/${id}/print-invoice`}><button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-sm">🖨️ Print</button></Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-2xl">
        <table className="w-full text-left mb-8 border-collapse">
          <thead className="text-slate-500 border-b-2 border-slate-800 text-xs uppercase tracking-wider">
            <tr>
              <th className="pb-3 w-1/2">Description</th>
              <th className="pb-3 text-center">Qty / Hrs</th>
              <th className="pb-3 text-right">Unit Price</th>
              <th className="pb-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const gk = line.id ?? idx
              const rows: any[] = []
              const lAmt = (line.labor||[]).reduce((a:number,l:any)=>a+(Number(l.hours)||0)*(Number(l.rate)||0),0)
              const pAmt = (line.parts||[]).reduce((a:number,p:any)=>a+(Number(p.qty)||0)*getSellPrice(Number(p.price)||0,custType,settings),0)
              rows.push(<tr key={`h-${gk}`} className="bg-slate-800/60"><td className="py-3 pl-3 font-bold text-amber-400" colSpan={3}>{idx+1}. {line.title}</td><td className="py-3 pr-3 text-right font-bold text-amber-400">{fmt(lAmt+pAmt)}</td></tr>)
              ;(line.labor||[]).forEach((l:any,i:number)=>rows.push(<tr key={`l-${gk}-${i}`} className="border-b border-slate-800/40 text-slate-300"><td className="py-2 pl-8 text-sm"><span className="text-slate-500 text-xs uppercase mr-1">Labor</span>{l.desc}</td><td className="py-2 text-center text-sm">{l.hours}h</td><td className="py-2 text-right text-sm text-slate-400">{fmt(l.rate)}/hr</td><td className="py-2 text-right text-sm">{fmt(Number(l.hours)*Number(l.rate))}</td></tr>))
              ;(line.parts||[]).forEach((p:any,i:number)=>{const sell=getSellPrice(Number(p.price)||0,custType,settings);rows.push(<tr key={`p-${gk}-${i}`} className="border-b border-slate-800/40 text-slate-300"><td className="py-2 pl-8 text-sm"><span className="text-slate-500 text-xs uppercase mr-1">Part</span>{p.name}{p.partNumber&&<span className="ml-2 font-mono text-xs text-slate-500 bg-slate-800 px-1 rounded">{p.partNumber}</span>}</td><td className="py-2 text-center text-sm">×{p.qty}</td><td className="py-2 text-right text-sm text-slate-400">{fmt(sell)}</td><td className="py-2 text-right text-sm">{fmt(Number(p.qty)*sell)}</td></tr>)})
              rows.push(<tr key={`sp-${gk}`}><td colSpan={4} className="h-3"></td></tr>)
              return rows
            })}
          </tbody>
        </table>
        <div className="flex justify-end border-t-2 border-slate-800 pt-6">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-slate-400 text-sm"><span>Labor</span><span>{fmt(totals.laborTotal)}</span></div>
            <div className="flex justify-between text-slate-400 text-sm"><span>Parts</span><span>{fmt(totals.partsTotal)}</span></div>
            <div className="flex justify-between text-slate-400 text-sm border-b border-slate-800 pb-2"><span>Tax ({settings.tax_rate}%)</span><span>{fmt(totals.taxAmt)}</span></div>
            <div className="flex justify-between text-3xl font-bold text-white pt-1"><span>Total</span><span className="text-green-400">{fmt(totals.grandTotal)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
