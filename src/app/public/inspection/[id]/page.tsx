'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

export default function PublicInspectionPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<any>(null)
  const [inspection, setInspection] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Job (No Auth Check needed due to RLS update)
      const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
      const { data: inspData } = await supabase.from('inspections').select('checklist').eq('job_id', id).single()

      if (jobData) {
        setJob(jobData)
        setInspection(inspData?.checklist || {})
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div className="p-10 text-center bg-white text-slate-500">Loading Report...</div>
  if (!job) return <div className="p-10 text-center bg-white text-slate-500">Report not found.</div>

  const getItemsByStatus = (status: string) => Object.keys(inspection).filter(key => inspection[key].status === status)
  const passItems = getItemsByStatus('pass')
  const failItems = getItemsByStatus('fail')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      
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
            <div>
              <span className="text-slate-400 block text-xs uppercase font-bold">Unit #</span>
              <span className="font-mono">{job.vehicles.unit_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase font-bold">VIN</span>
              <span className="font-mono">{job.vehicles.vin?.slice(-6) || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* FAIL ITEMS (Red) */}
        {failItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="font-bold text-red-900">Attention Required</h3>
            </div>
            <div className="divide-y divide-red-50">
              {failItems.map(item => (
                <div key={item} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">{item}</span>
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">FAIL</span>
                  </div>
                  {inspection[item].note && (
                    <div className="text-sm text-red-600 italic bg-red-50/50 p-2 rounded">
                      "{inspection[item].note}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PASS ITEMS (Green) */}
        <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
          <div className="bg-green-50 p-4 border-b border-green-100 flex items-center gap-2">
            <span className="text-xl">✅</span>
            <h3 className="font-bold text-green-900">Passed Inspection</h3>
          </div>
          <div className="p-4 grid grid-cols-1 gap-y-3">
            {passItems.map(item => (
              <div key={item} className="flex justify-between items-center">
                <span className="text-slate-600">{item}</span>
                <span className="text-green-500 text-lg">✓</span>
              </div>
            ))}
            {passItems.length === 0 && <p className="text-slate-400 text-center text-sm">No items marked as Passed.</p>}
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div className="text-center text-slate-400 text-xs mt-8 px-4">
        <p>© Heavy Haul Auto Service LLC</p>
        <p className="mt-1">Carmel, IN</p>
      </div>
    </div>
  )
}