'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InvoicePage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  
  const [invoiceJobs, setInvoiceJobs] = useState<any[]>([])
  
  const [totals, setTotals] = useState({ parts: 0, labor: 0, tax: 0, total: 0 })

  useEffect(() => {
    async function fetchData() {
        const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
        const { data: inspData } = await supabase.from('inspections').select('recommendations').eq('job_id', id).single()
        
        if (jobData && inspData?.recommendations) {
            const recs = inspData.recommendations
            let finalJobs = []

            // 1. CHECK FOR NEW SYSTEM (service_lines)
            if (recs.service_lines && Array.isArray(recs.service_lines)) {
                finalJobs = recs.service_lines
            } 
            // 2. FALLBACK FOR OLD INVOICES (Convert legacy data to new format)
            else {
                const approvedOld = Object.values(recs).filter((r: any) => r.decision === 'approved')
                finalJobs = approvedOld.map((item: any) => ({
                    id: Math.random(),
                    title: item.service,
                    // Force Number() conversion here just in case
                    labor: item.labor ? [{ desc: 'Service Labor', hours: 1, rate: Number(item.labor) }] : [], 
                    parts: item.parts ? [{ name: 'Service Parts', qty: 1, price: Number(item.parts), partNumber: 'N/A' }] : []
                }))
            }

            setInvoiceJobs(finalJobs)

            // 3. CALCULATE TOTALS (Loop through hierarchies)
            let pTotal = 0
            let lTotal = 0

            finalJobs.forEach((j: any) => {
                // Sum Labor (Safe Number conversion)
                if(j.labor) j.labor.forEach((l: any) => lTotal += (Number(l.hours || 0) * Number(l.rate || 0)))
                // Sum Parts (Safe Number conversion)
                if(j.parts) j.parts.forEach((p: any) => pTotal += (Number(p.qty || 0) * Number(p.price || 0)))
            })

            const tax = pTotal * 0.07
            setTotals({ parts: pTotal, labor: lTotal, tax, total: pTotal + lTotal + tax })
            setJob(jobData)
        }
        setLoading(false)
    }
    fetchData()
  }, [id])

  const copyPublicInvoice = () => {
    const url = `${window.location.origin}/public/invoice/${id}`
    navigator.clipboard.writeText(url)
    alert('Invoice Link Copied!\n\n' + url)
  }

  // Helper to format currency (Safely handles strings)
  const fmt = (n: any) => {
      const num = Number(n) || 0
      return `$${num.toFixed(2)}`
  }

  if (loading) return <div className="p-10 text-white bg-slate-950 min-h-screen">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
      
      {/* HEADER */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold">Invoice #{job.id.slice(0,8)}</h1>
          <p className="text-slate-400">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
          <p className="text-sm text-slate-500 mt-1">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
        </div>
        <div className="flex gap-3">
            <Link href={`/jobs/${id}`}>
                <button className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Back to Job</button>
            </Link>
            <button onClick={copyPublicInvoice} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg flex items-center gap-2">
                🔗 Share with Customer
            </button>
            <Link href={`/jobs/${id}/print-invoice`}>
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded shadow-lg flex items-center gap-2">
                 🖨️ Print PDF
              </button>
            </Link>
        </div>
      </div>

      {/* INVOICE CONTENT */}
      <div className="max-w-4xl mx-auto bg-slate-900 rounded-lg p-8 border border-slate-800 shadow-2xl">
        
        <table className="w-full text-left mb-8 border-collapse">
            <thead className="text-slate-500 border-b-2 border-slate-800 text-xs uppercase tracking-wider">
                <tr>
                    <th className="pb-3 w-1/2">Description / Part #</th>
                    <th className="pb-3 text-center">Qty / Hrs</th>
                    <th className="pb-3 text-right">Rate / Price</th>
                    <th className="pb-3 text-right">Amount</th>
                </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-800/50">
                {invoiceJobs.map((jobLine, idx) => {
                    // Calculate Job Subtotal with Safe Numbers
                    const jobLabor = jobLine.labor?.reduce((acc: number, l: any) => acc + (Number(l.hours || 0) * Number(l.rate || 0)), 0) || 0
                    const jobParts = jobLine.parts?.reduce((acc: number, p: any) => acc + (Number(p.qty || 0) * Number(p.price || 0)), 0) || 0
                    const jobTotal = jobLabor + jobParts

                    return (
                        <>
                            {/* JOB HEADER ROW */}
                            <tr key={`header-${idx}`} className="bg-slate-800/50">
                                <td className="py-3 pl-2 font-bold text-indigo-400" colSpan={3}>
                                    {idx + 1}. {jobLine.title}
                                </td>
                                <td className="py-3 text-right font-bold text-indigo-400">
                                    {fmt(jobTotal)}
                                </td>
                            </tr>

                            {/* LABOR ROWS */}
                            {jobLine.labor?.map((l: any, lIdx: number) => (
                                <tr key={`labor-${idx}-${lIdx}`} className="text-slate-300 hover:bg-slate-800/30">
                                    <td className="py-2 pl-6 text-sm">
                                        <span className="text-slate-500 text-xs mr-2 uppercase tracking-wide">Labor</span>
                                        {l.desc}
                                    </td>
                                    {/* FORCE NUMBER CONVERSION ON DISPLAY */}
                                    <td className="py-2 text-center text-sm">{l.hours}</td>
                                    <td className="py-2 text-right text-sm text-slate-400">{fmt(l.rate)}</td>
                                    <td className="py-2 text-right text-sm">{fmt(Number(l.hours) * Number(l.rate))}</td>
                                </tr>
                            ))}

                            {/* PARTS ROWS */}
                            {jobLine.parts?.map((p: any, pIdx: number) => (
                                <tr key={`part-${idx}-${pIdx}`} className="text-slate-300 hover:bg-slate-800/30">
                                    <td className="py-2 pl-6 text-sm">
                                        <span className="text-slate-500 text-xs mr-2 uppercase tracking-wide">Part</span>
                                        {p.name} 
                                        {p.partNumber && <span className="ml-2 font-mono text-xs text-slate-500 bg-slate-800 px-1 rounded">{p.partNumber}</span>}
                                    </td>
                                    {/* FORCE NUMBER CONVERSION ON DISPLAY */}
                                    <td className="py-2 text-center text-sm">{p.qty}</td>
                                    <td className="py-2 text-right text-sm text-slate-400">{fmt(p.price)}</td>
                                    <td className="py-2 text-right text-sm">{fmt(Number(p.qty) * Number(p.price))}</td>
                                </tr>
                            ))}
                            
                            {/* Spacer Row */}
                            <tr><td colSpan={4} className="h-4"></td></tr>
                        </>
                    )
                })}
            </tbody>
        </table>
        
        {/* FOOTER TOTALS */}
        <div className="flex justify-end border-t-2 border-slate-800 pt-6">
            <div className="w-72 space-y-3">
                <div className="flex justify-between text-slate-400 text-sm">
                    <span>Labor Total</span>
                    <span>{fmt(totals.labor)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-sm">
                    <span>Parts Total</span>
                    <span>{fmt(totals.parts)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-sm border-b border-slate-800 pb-2">
                    <span>Tax (7%)</span>
                    <span>{fmt(totals.tax)}</span>
                </div>
                <div className="flex justify-between text-3xl font-bold text-white pt-2">
                    <span>Total</span>
                    <span className="text-green-400">{fmt(totals.total)}</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}