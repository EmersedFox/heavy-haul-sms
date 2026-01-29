'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InspectionPrintPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  const [inspection, setInspection] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
      const { data: inspData } = await supabase.from('inspections').select('checklist').eq('job_id', id).single()

      if (!jobData) { router.push('/dashboard'); return }

      setJob(jobData)
      setInspection(inspData?.checklist || {})
      setLoading(false)
    }
    fetchData()
  }, [id, router])

  if (loading) return <div className="p-10 bg-white text-black">Loading Report...</div>

  const getItemsByStatus = (status: string) => Object.keys(inspection).filter(key => inspection[key].status === status)
  
  const passItems = getItemsByStatus('pass')
  const failItems = getItemsByStatus('fail')

  return (
    // CHANGE 1: Added flex flex-col to outer container
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0 flex flex-col">
      
      {/* NO-PRINT CONTROLS */}
      <div className="print:hidden flex justify-between items-center mb-8 bg-slate-900 text-white p-4 rounded">
        <div className="font-bold text-amber-500">INSPECTION REPORT PREVIEW</div>
        <div className="flex gap-4">
          <Link href={`/jobs/${id}`} className="px-4 py-2 text-slate-300 hover:text-white">← Back</Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded">
            🖨️ Print Report
          </button>
        </div>
      </div>

      {/* CHANGE 2: Wrapped content in flex-grow to push footer down */}
      <div className="flex-grow">
        
        {/* REPORT HEADER */}
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Heavy Haul <span className="text-amber-600">Auto Service</span> LLC</h1>
            <h2 className="text-xl font-bold text-slate-500 uppercase mt-1">Vehicle Health Report</h2>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Date: {new Date().toLocaleDateString()}</p>
            <p>Ticket #: {job.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* VEHICLE INFO CARD */}
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

        {/* SECTION 1: ATTENTION REQUIRED (Red) */}
        {failItems.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4 text-red-600 border-b border-red-200 pb-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-xl font-bold uppercase">Attention Required</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {failItems.map(item => (
                <div key={item} className="p-3 bg-red-50 border border-red-100 rounded print:border-red-300 break-inside-avoid">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-red-900">{item}</span>
                    <span className="px-3 py-1 bg-red-200 text-red-800 text-xs font-bold uppercase rounded print:border print:border-red-800">Failed</span>
                  </div>
                  {/* Note Display */}
                  {inspection[item].note && (
                     <div className="mt-2 text-sm text-red-800 italic border-l-2 border-red-300 pl-2">
                       "{inspection[item].note}"
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: PASSED ITEMS (Green) */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-green-600 border-b border-green-200 pb-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-xl font-bold uppercase">Passed Inspection</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 print:grid-cols-2">
            {passItems.map(item => (
              <div key={item} className="flex justify-between items-center py-2 border-b border-slate-100 print:border-slate-200 break-inside-avoid">
                <span className="text-slate-700 font-medium">{item}</span>
                <span className="text-green-700 text-xs font-bold uppercase tracking-wider">OK</span>
              </div>
            ))}
          </div>
          
          {passItems.length === 0 && <p className="text-slate-400 italic">No items marked as Passed.</p>}
        </div>

      </div>

      {/* CHANGE 3: Footer is now static (Removed print:fixed) */}
      <div className="mt-12 pt-8 border-t border-slate-200 text-center text-sm text-slate-400">
        <p>Heavy Haul Auto Service LLC • 463-777-4429</p>
        <p className="italic mt-1 text-xs">This report is a visual inspection only.</p>
      </div>

    </div>
  )
}