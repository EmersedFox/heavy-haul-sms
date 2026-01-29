'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

export default function PublicInvoicePage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  
  // Stores the list of Jobs (containers with parts/labor)
  const [invoiceJobs, setInvoiceJobs] = useState<any[]>([])
  
  const [totals, setTotals] = useState({ parts: 0, labor: 0, tax: 0, total: 0 })

  // SHOP SETTINGS
  const SHOP_INFO = {
    name: "Heavy Haul Auto Service LLC",
    address: "P.O. Box 4742, Carmel, IN 46082",
    phone: "463-777-4429",
    taxRate: 0.07 // 7% Indiana Sales Tax
  }

  useEffect(() => {
    async function fetchInvoiceData() {
      // 1. Fetch Job & Customer Details
      const { data: jobData, error } = await supabase
        .from('jobs')
        .select(`*, vehicles (*, customers (*))`)
        .eq('id', id)
        .single()

      if (error || !jobData) {
        setLoading(false)
        return
      }

      // 2. Fetch Invoice Items
      const { data: inspData } = await supabase
        .from('inspections')
        .select('recommendations')
        .eq('job_id', id)
        .single()

      if (inspData && inspData.recommendations) {
        const recs = inspData.recommendations
        let finalJobs = []

        // A. NEW SYSTEM: Check for Service Lines
        if (recs.service_lines && Array.isArray(recs.service_lines)) {
            finalJobs = recs.service_lines
        } 
        // B. OLD SYSTEM: Convert Legacy Recommendations
        else {
            const approvedOld = Object.values(recs).filter((r: any) => r.decision === 'approved')
            finalJobs = approvedOld.map((item: any) => ({
                id: Math.random(),
                title: item.service,
                labor: item.labor ? [{ desc: 'Service Labor', hours: 1, rate: Number(item.labor) }] : [], 
                parts: item.parts ? [{ name: 'Service Parts', qty: 1, price: Number(item.parts), partNumber: 'N/A' }] : []
            }))
        }

        setInvoiceJobs(finalJobs)

        // Calculate Totals
        let pTotal = 0
        let lTotal = 0

        finalJobs.forEach((j: any) => {
            if(j.labor) j.labor.forEach((l: any) => lTotal += (Number(l.hours || 0) * Number(l.rate || 0)))
            if(j.parts) j.parts.forEach((p: any) => pTotal += (Number(p.qty || 0) * Number(p.price || 0)))
        })

        const tax = pTotal * SHOP_INFO.taxRate
        setTotals({ parts: pTotal, labor: lTotal, tax, total: pTotal + lTotal + tax })
      }

      setJob(jobData)
      setLoading(false)
    }
    fetchInvoiceData()
  }, [id])

  // Helper for Currency
  const fmt = (n: number) => `$${n.toFixed(2)}`

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Invoice...</div>
  if (!job) return <div className="p-10 text-center text-red-500">Invoice not found.</div>

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 font-sans text-slate-900 print:bg-white print:p-0">
      
      {/* INVOICE CARD */}
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden border border-slate-200 print:shadow-none print:border-0">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-8 flex justify-between items-center print:bg-white print:text-black print:border-b-4 print:border-slate-900">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-amber-500 print:text-slate-900">Invoice</h1>
            <p className="text-slate-400 text-sm print:text-slate-600">#{job.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-lg">{SHOP_INFO.name}</h2>
            <p className="text-sm text-slate-400 print:text-slate-600">{SHOP_INFO.address}</p>
            <p className="text-sm text-slate-400 print:text-slate-600">{SHOP_INFO.phone}</p>
          </div>
        </div>

        {/* CUSTOMER & VEHICLE */}
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Bill To</h3>
            <p className="font-bold text-xl text-slate-800">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            <p className="text-slate-600">{job.vehicles.customers.company_name}</p>
            <p className="text-slate-500">{job.vehicles.customers.phone}</p>
            <p className="text-slate-500">{job.vehicles.customers.email}</p>
          </div>
          <div className="md:text-right">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Vehicle Details</h3>
            <p className="font-bold text-xl text-slate-800">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <p className="text-slate-500 font-mono text-sm">VIN: {job.vehicles.vin}</p>
            {job.vehicles.unit_number && <p className="text-xs bg-slate-100 inline-block px-2 py-1 rounded mt-1 border border-slate-200">Unit #{job.vehicles.unit_number}</p>}
          </div>
        </div>

        {/* LINE ITEMS */}
        <div className="p-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 border-b border-slate-200 pb-2">Services Performed</h3>
          
          <div className="space-y-6">
            {invoiceJobs.length === 0 ? (
              <p className="text-center text-slate-400 italic py-4">No billable items.</p>
            ) : (
              invoiceJobs.map((jobLine: any, index: number) => {
                 // Calculate Line Total for Display
                 const lineLabor = jobLine.labor?.reduce((acc: number, l: any) => acc + (l.hours * l.rate), 0) || 0
                 const lineParts = jobLine.parts?.reduce((acc: number, p: any) => acc + (p.qty * p.price), 0) || 0
                 const lineTotal = lineLabor + lineParts

                 return (
                    <div key={index} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        {/* Job Title Row */}
                        <div className="flex justify-between items-start mb-2">
                           <div className="pr-4">
                              <p className="font-bold text-lg text-slate-800">
                                <span className="text-amber-600 text-sm mr-2">{index + 1}.</span> 
                                {jobLine.title}
                              </p>
                           </div>
                           <div className="font-bold text-slate-900 text-lg">
                              {fmt(lineTotal)}
                           </div>
                        </div>

                        {/* Detail Rows (Labor & Parts) */}
                        <div className="pl-6 space-y-1">
                            {jobLine.labor?.map((l: any, i: number) => (
                                <div key={`l-${i}`} className="flex justify-between text-sm text-slate-500">
                                    <span>Labor: {l.desc} <span className="text-xs text-slate-400">({l.hours} hrs)</span></span>
                                    <span>{fmt(l.hours * l.rate)}</span>
                                </div>
                            ))}
                            {jobLine.parts?.map((p: any, i: number) => (
                                <div key={`p-${i}`} className="flex justify-between text-sm text-slate-500">
                                    <span>Part: {p.name} <span className="text-xs text-slate-400">(x{p.qty})</span></span>
                                    <span>{fmt(p.qty * p.price)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                 )
              })
            )}
          </div>
        </div>

        {/* TOTALS */}
        <div className="bg-slate-50 p-8 border-t border-slate-200 print:bg-white">
          <div className="flex flex-col md:flex-row justify-end">
             <div className="w-full md:w-1/2 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Parts Total</span>
                  <span>{fmt(totals.parts)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Labor Total</span>
                  <span>{fmt(totals.labor)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Tax (7%)</span>
                  <span>{fmt(totals.tax)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 text-2xl font-bold pt-2">
                  <span>Total Due</span>
                  <span className="text-amber-600">{fmt(totals.total)}</span>
                </div>
             </div>
          </div>
        </div>

        {/* FOOTER ACTION (Hidden on Print) */}
        <div className="p-4 bg-slate-900 text-center print:hidden">
          <button 
            onClick={() => window.print()} 
            className="text-white font-bold text-sm flex items-center justify-center gap-2 w-full py-2 hover:text-amber-500 transition-colors"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>

      </div>
      
      <div className="text-center mt-6 text-slate-400 text-xs print:hidden">
        <p>Thank you for choosing Heavy Haul Auto Service.</p>
      </div>
    </div>
  )
}