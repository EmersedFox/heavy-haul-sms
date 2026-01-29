'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PrintInvoicePage() {
  const { id } = useParams()
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

            // 1. Load Service Lines (New System) or Convert Recommendations (Old System)
            if (recs.service_lines && Array.isArray(recs.service_lines)) {
                finalJobs = recs.service_lines
            } else {
                const approvedOld = Object.values(recs).filter((r: any) => r.decision === 'approved')
                finalJobs = approvedOld.map((item: any) => ({
                    id: Math.random(),
                    title: item.service,
                    // Force Number conversion
                    labor: item.labor ? [{ desc: 'Service Labor', hours: 1, rate: Number(item.labor) }] : [], 
                    parts: item.parts ? [{ name: 'Service Parts', qty: 1, price: Number(item.parts), partNumber: 'N/A' }] : []
                }))
            }

            setInvoiceJobs(finalJobs)

            // 2. Calculate Totals (Force Numbers)
            let pTotal = 0
            let lTotal = 0
            finalJobs.forEach((j: any) => {
                if(j.labor) j.labor.forEach((l: any) => lTotal += (Number(l.hours || 0) * Number(l.rate || 0)))
                if(j.parts) j.parts.forEach((p: any) => pTotal += (Number(p.qty || 0) * Number(p.price || 0)))
            })

            const tax = pTotal * 0.07 // 7% Tax Rate
            setTotals({ parts: pTotal, labor: lTotal, tax, total: pTotal + lTotal + tax })
            setJob(jobData)
        }
        setLoading(false)
    }
    fetchData()
  }, [id])

  // Safe Currency Helper (Prevents the crash)
  const fmt = (n: any) => {
      const num = Number(n) || 0
      return `$${num.toFixed(2)}`
  }

  if (loading) return <div className="p-10 bg-white text-slate-900 font-sans">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0 flex flex-col">
      
      {/* NO-PRINT CONTROLS */}
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded shadow-lg">
        <div className="font-bold text-amber-500">INVOICE PREVIEW</div>
        <div className="flex gap-4">
          <Link href={`/jobs/${id}/invoice`} className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 rounded transition-colors">← Back to Dashboard</Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded transition-colors">
            🖨️ Print Invoice
          </button>
        </div>
      </div>

      {/* REPORT CONTENT */}
      <div className="flex-grow max-w-5xl mx-auto w-full">
        
        {/* HEADER */}
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Heavy Haul <span className="text-amber-600">Auto Service</span> LLC
            </h1>
            <div className="mt-2 text-sm font-bold text-slate-800">
               <p>P.O. Box 4742, Carmel, IN 46082</p>
               <p>463-777-4429</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-slate-400 uppercase">INVOICE</h2>
            <p className="text-lg font-mono font-bold text-slate-900">#{job.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-slate-600">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* CUSTOMER & VEHICLE INFO */}
        <div className="bg-slate-100 p-6 rounded-lg mb-8 border border-slate-200 grid grid-cols-2 gap-8 print:bg-transparent print:border-slate-300">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To</h3>
            <p className="font-bold text-lg">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            <p className="text-slate-600">{job.vehicles.customers.company_name}</p>
            <p className="text-slate-600 text-sm mt-1">{job.vehicles.customers.phone}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Vehicle Details</h3>
            <p className="font-bold text-lg">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <div className="flex gap-4 mt-1">
               <p className="font-mono text-slate-600 text-sm"><span className="text-slate-400">VIN:</span> {job.vehicles.vin || 'N/A'}</p>
               <p className="text-slate-600 text-sm"><span className="text-slate-400">Unit:</span> {job.vehicles.unit_number || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* INVOICE ITEMS TABLE */}
        <div className="mb-8">
           <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-xs">
                  <th className="p-3 text-left w-1/2">Description / Operation</th>
                  <th className="p-3 text-center">Qty / Hrs</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 border border-slate-200">
                {invoiceJobs.map((jobLine, idx) => {
                     // Calculate Line Total (Safe Numbers)
                     const jobLabor = jobLine.labor?.reduce((acc: any, l: any) => acc + (Number(l.hours) * Number(l.rate)), 0) || 0
                     const jobParts = jobLine.parts?.reduce((acc: any, p: any) => acc + (Number(p.qty) * Number(p.price)), 0) || 0
                     
                     return (
                        <>
                            {/* JOB HEADER ROW */}
                            <tr key={idx} className="bg-slate-100 print:bg-slate-50 font-bold">
                                <td className="p-3 text-slate-900" colSpan={3}>
                                    <span className="text-amber-600 mr-2">{idx + 1}.</span> 
                                    {jobLine.title}
                                </td>
                                <td className="p-3 text-right text-slate-900">{fmt(jobLabor + jobParts)}</td>
                            </tr>
                            
                            {/* LABOR DETAILS */}
                            {jobLine.labor?.map((l: any, i: number) => (
                                <tr key={`l-${i}`} className="text-slate-600">
                                    <td className="p-2 pl-8 text-xs italic">Labor: {l.desc}</td>
                                    <td className="p-2 text-center text-xs">{l.hours}</td>
                                    <td className="p-2 text-right text-xs">{fmt(l.rate)}</td>
                                    <td className="p-2 text-right text-xs">{fmt(Number(l.hours) * Number(l.rate))}</td>
                                </tr>
                            ))}

                            {/* PARTS DETAILS */}
                            {jobLine.parts?.map((p: any, i: number) => (
                                <tr key={`p-${i}`} className="text-slate-600">
                                    <td className="p-2 pl-8 text-xs italic">
                                        Part: {p.name} 
                                        {p.partNumber && <span className="ml-2 font-mono text-slate-400 text-[10px]">{p.partNumber}</span>}
                                    </td>
                                    <td className="p-2 text-center text-xs">{p.qty}</td>
                                    <td className="p-2 text-right text-xs">{fmt(p.price)}</td>
                                    <td className="p-2 text-right text-xs">{fmt(Number(p.qty) * Number(p.price))}</td>
                                </tr>
                            ))}
                        </>
                     )
                })}
              </tbody>
           </table>
        </div>

        {/* TOTALS & FOOTER */}
        <div className="flex justify-end mb-12 break-inside-avoid">
           <div className="w-64 bg-slate-50 p-4 rounded border border-slate-200 print:border-slate-300">
               <div className="flex justify-between mb-2 text-slate-500 text-sm">
                   <span>Labor</span>
                   <span>{fmt(totals.labor)}</span>
               </div>
               <div className="flex justify-between mb-2 text-slate-500 text-sm">
                   <span>Parts</span>
                   <span>{fmt(totals.parts)}</span>
               </div>
               <div className="flex justify-between mb-3 text-slate-500 text-sm border-b border-slate-300 pb-2">
                   <span>Tax (7%)</span>
                   <span>{fmt(totals.tax)}</span>
               </div>
               <div className="flex justify-between text-xl font-bold text-slate-900">
                   <span>TOTAL</span>
                   <span>{fmt(totals.total)}</span>
               </div>
           </div>
        </div>

        {/* DISCLAIMER / SIGNATURE */}
        <div className="mt-auto pt-8 border-t-2 border-slate-200">
            <p className="text-xs text-slate-500 mb-8 text-justify leading-relaxed">
                I hereby authorize the repair work herein set forth to be done along with the necessary material and agree that you are not responsible for loss or damage to vehicle or articles left in vehicle in case of fire, theft, or any other cause beyond your control. I hereby grant you and/or your employees permission to operate the vehicle herein described on streets, highways, or elsewhere for the purpose of testing and/or inspection. An express mechanic's lien is hereby acknowledged on above vehicle to secure the amount of repairs thereto.
            </p>
            <div className="flex justify-between items-end gap-12">
                <div className="w-2/3 border-b border-slate-900 h-8"></div>
                <div className="w-1/3 text-right text-sm font-bold text-slate-700">Customer Signature / Date</div>
            </div>
            
            <div className="mt-8 text-center text-sm text-slate-400">
               <p>Heavy Haul Auto Service LLC • P.O. Box 4742, Carmel, IN 46082</p>
               <p className="font-bold text-amber-500 mt-1">THANK YOU FOR YOUR BUSINESS!</p>
            </div>
        </div>

      </div>
    </div>
  )
}