'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fmt, getSellPrice, computeTotals, DEFAULT_SETTINGS, type ShopSettings } from '@/lib/markup'

export default function PrintInvoicePage() {
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

  if (loading) return <div className="p-10 bg-white text-slate-900 font-sans">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0 flex flex-col">
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded shadow-lg">
        <span className="font-bold text-amber-500">INVOICE PREVIEW</span>
        <div className="flex gap-3">
          <Link href={`/jobs/${id}/invoice`} className="px-4 py-2 text-slate-300 border border-slate-700 rounded text-sm">← Back</Link>
          <button onClick={()=>window.print()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded text-sm">🖨️ Print</button>
        </div>
      </div>

      <div className="flex-grow max-w-5xl mx-auto w-full">
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Heavy Haul <span className="text-amber-600">Auto Service</span> LLC</h1>
            <p className="text-sm font-bold text-slate-700 mt-2">P.O. Box 4742, Carmel, IN 46082 · 463-777-4429</p>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-slate-400 uppercase">Invoice</h2>
            <p className="text-lg font-mono font-bold">#{job.id.slice(0,8).toUpperCase()}</p>
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg mb-8 border border-slate-200 grid grid-cols-2 gap-8 print:bg-transparent print:border-slate-300">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To</p>
            <p className="font-bold text-lg">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            {job.vehicles.customers.company_name && <p className="text-slate-600">{job.vehicles.customers.company_name}</p>}
            <p className="text-slate-600 text-sm">{job.vehicles.customers.phone}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Vehicle</p>
            <p className="font-bold text-lg">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <p className="font-mono text-slate-600 text-sm">VIN: {job.vehicles.vin||'N/A'}</p>
            {job.vehicles.unit_number && <p className="text-slate-600 text-sm">Unit #: {job.vehicles.unit_number}</p>}
            {job.odometer && <p className="font-mono text-slate-600 text-sm">ODO: {Number(job.odometer).toLocaleString()} mi</p>}
          </div>
        </div>

        <div className="mb-8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase">
                <th className="p-3 text-left w-1/2">Description</th>
                <th className="p-3 text-center">Qty/Hrs</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="border border-slate-200">
              {lines.map((line, idx) => {
                const gk = line.id ?? idx
                const rows: any[] = []
                const lAmt = (line.labor||[]).reduce((a:number,l:any)=>a+(Number(l.hours)||0)*(Number(l.rate)||0),0)
                const pAmt = (line.parts||[]).reduce((a:number,p:any)=>a+(Number(p.qty)||0)*getSellPrice(Number(p.price)||0,custType,settings),0)
                rows.push(<tr key={`h-${gk}`} className="bg-slate-100 print:bg-slate-50 font-bold border-b border-slate-200"><td className="p-3" colSpan={3}><span className="text-amber-600 mr-2">{idx+1}.</span>{line.title}</td><td className="p-3 text-right">{fmt(lAmt+pAmt)}</td></tr>)
                ;(line.labor||[]).forEach((l:any,i:number)=>rows.push(<tr key={`l-${gk}-${i}`} className="border-b border-slate-100 text-slate-600"><td className="p-2 pl-8 text-xs italic">Labor: {l.desc}</td><td className="p-2 text-center text-xs">{l.hours}h</td><td className="p-2 text-right text-xs">{fmt(l.rate)}/hr</td><td className="p-2 text-right text-xs">{fmt(Number(l.hours)*Number(l.rate))}</td></tr>))
                ;(line.parts||[]).forEach((p:any,i:number)=>{const sell=getSellPrice(Number(p.price)||0,custType,settings);rows.push(<tr key={`p-${gk}-${i}`} className="border-b border-slate-100 text-slate-600"><td className="p-2 pl-8 text-xs italic">Part: {p.name}{p.partNumber&&<span className="ml-1 font-mono text-slate-400 text-[10px]">{p.partNumber}</span>}</td><td className="p-2 text-center text-xs">×{p.qty}</td><td className="p-2 text-right text-xs">{fmt(sell)}</td><td className="p-2 text-right text-xs">{fmt(Number(p.qty)*sell)}</td></tr>)})
                return rows
              })}
            </tbody>
          </table>
        </div>

        <div style={{ breakInside:'avoid', pageBreakInside:'avoid' }}>
          <div className="flex justify-end mb-10 pt-4 border-t-2 border-slate-200">
            <div className="w-64 bg-slate-50 p-4 rounded border border-slate-200 print:border-slate-300 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>Labor</span><span>{fmt(totals.laborTotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Parts</span><span>{fmt(totals.partsTotal)}</span></div>
              <div className="flex justify-between text-slate-500 border-b border-slate-300 pb-2"><span>Tax ({settings.tax_rate}%)</span><span>{fmt(totals.taxAmt)}</span></div>
              <div className="flex justify-between text-xl font-bold text-slate-900"><span>TOTAL</span><span>{fmt(totals.grandTotal)}</span></div>
            </div>
          </div>
          <div className="pt-6 border-t-2 border-slate-200">
            <p className="text-xs text-slate-500 mb-8 text-justify leading-relaxed">I hereby authorize the repair work herein set forth to be done along with the necessary material and agree that you are not responsible for loss or damage to vehicle or articles left in vehicle in case of fire, theft, or any other cause beyond your control. I hereby grant you and/or your employees permission to operate the vehicle herein described on streets, highways, or elsewhere for the purpose of testing and/or inspection. An express mechanic's lien is hereby acknowledged on above vehicle to secure the amount of repairs thereto.</p>
            <div className="flex justify-between items-end gap-12">
              <div className="w-2/3 border-b border-slate-900 h-8"></div>
              <div className="w-1/3 text-right text-sm font-bold text-slate-700">Customer Signature / Date</div>
            </div>
            <div className="mt-8 text-center text-sm text-slate-400">
              <p>Heavy Haul Auto Service LLC · P.O. Box 4742, Carmel, IN 46082</p>
              <p className="font-bold text-amber-600 mt-1">THANK YOU FOR YOUR BUSINESS!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
