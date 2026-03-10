'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const fmt = (n: any) => `$${(Math.round((Number(n)||0)*100)/100).toFixed(2)}`

export default function JobHistoryPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [currentJob, setCurrentJob] = useState<any>(null)
  const [history,   setHistory]   = useState<any[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      // Load the current job to get vehicle_id and customer_id
      const { data: job } = await supabase
        .from('jobs')
        .select('*, vehicles(*, customers(*))')
        .eq('id', id)
        .single()

      if (!job) { router.push('/dashboard'); return }
      setCurrentJob(job)

      // Fetch all OTHER jobs for the same vehicle
      const { data: vehicleJobs } = await supabase
        .from('jobs')
        .select(`
          id, status, created_at, customer_complaint, tech_diagnosis,
          odometer, payment_status, payment_method, amount_paid,
          vehicles(year, make, model, vin, customers(first_name, last_name)),
          inspections(recommendations)
        `)
        .eq('vehicle_id', job.vehicle_id)
        .neq('id', id)
        .order('created_at', { ascending: false })

      // Also fetch all jobs for the same customer across ALL vehicles
      const customerId = job.vehicles.customers.id
      const { data: customerJobs } = await supabase
        .from('jobs')
        .select(`
          id, status, created_at, customer_complaint,
          odometer, payment_status, amount_paid,
          vehicles(year, make, model, vin)
        `)
        .eq('vehicles.customers.id', customerId)  // filter via join
        .neq('vehicle_id', job.vehicle_id)        // different vehicle
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      // Combine: vehicle history first, then customer's other vehicles
      const combined = [
        ...(vehicleJobs || []).map((j: any) => ({ ...j, _type: 'same_vehicle' })),
        ...(customerJobs || []).map((j: any) => ({ ...j, _type: 'other_vehicle' })),
      ]

      setHistory(combined)
      setLoading(false)
    }
    load()
  }, [id, router])

  const getInvoiceTotal = (job: any) => {
    const recs = Array.isArray(job.inspections)
      ? job.inspections[0]?.recommendations
      : job.inspections?.recommendations
    if (!recs) return 0
    const lines = recs.service_lines || []
    if (lines.length > 0) {
      return lines.reduce((sum: number, j: any) => {
        const l = (j.labor||[]).reduce((a: number, l: any) => a + Number(l.hours||0)*Number(l.rate||0), 0)
        const p = (j.parts||[]).reduce((a: number, p: any) => a + Number(p.qty||0)*Number(p.price||0), 0)
        return sum + l + p
      }, 0)
    }
    return Object.values(recs).reduce((sum: number, r: any) => {
      if (r?.decision === 'approved') return sum + (Number(r.parts)||0) + (Number(r.labor)||0)
      return sum
    }, 0)
  }

  const statusColor: Record<string,string> = {
    scheduled: 'text-blue-400', in_shop: 'text-amber-400',
    waiting_approval: 'text-pink-400', waiting_parts: 'text-purple-400',
    ready: 'text-green-400', invoiced: 'text-slate-400', draft: 'text-slate-500',
  }
  const payBadge: Record<string,string> = {
    paid: 'bg-green-500/20 text-green-400 border-green-500/30',
    partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    unpaid: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading History...</div>

  const sameVehicle  = history.filter(j => j._type === 'same_vehicle')
  const otherVehicles = history.filter(j => j._type === 'other_vehicle')

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-4 border-b border-slate-800">
          <div>
            <Link href={`/jobs/${id}`} className="text-indigo-400 hover:text-white text-sm mb-3 block">← Back to Ticket</Link>
            <h1 className="text-3xl font-bold text-amber-500">Job History</h1>
            <p className="text-slate-400 mt-1">
              {currentJob.vehicles.year} {currentJob.vehicles.make} {currentJob.vehicles.model}
              <span className="font-mono text-slate-500 ml-2 text-sm">· {currentJob.vehicles.vin}</span>
            </p>
            <p className="text-slate-500 text-sm mt-0.5">
              Customer: {currentJob.vehicles.customers.first_name} {currentJob.vehicles.customers.last_name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{sameVehicle.length}</div>
            <div className="text-xs text-slate-500 uppercase font-bold">Prior Jobs<br/>This Vehicle</div>
          </div>
        </div>

        {/* Same vehicle history */}
        {sameVehicle.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-4">🔧</div>
            <p className="font-bold">No prior service history for this vehicle.</p>
            <p className="text-sm mt-1">This appears to be the first time it's been in the shop.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-10">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
              🚛 This Vehicle's Service History
            </h2>
            {sameVehicle.map(job => {
              const total = getInvoiceTotal(job)
              const isOpen = expanded === job.id
              return (
                <div key={job.id} className={`bg-slate-900 rounded-lg border transition-colors ${isOpen ? 'border-indigo-500/50' : 'border-slate-800 hover:border-slate-700'}`}>
                  <button className="w-full text-left p-5" onClick={() => setExpanded(isOpen ? null : job.id)}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs font-bold uppercase ${statusColor[job.status]||'text-slate-400'}`}>{job.status?.replace(/_/g,' ')}</span>
                          {job.payment_status && (
                            <span className={`text-[10px] font-bold border px-2 py-0.5 rounded uppercase ${payBadge[job.payment_status]||''}`}>{job.payment_status}</span>
                          )}
                          <span className="text-xs text-slate-500">{new Date(job.created_at).toLocaleDateString([], {year:'numeric',month:'short',day:'numeric'})}</span>
                          {job.odometer && <span className="text-xs text-slate-600 font-mono">{Number(job.odometer).toLocaleString()} mi</span>}
                        </div>
                        <p className="text-slate-200 mt-2 font-medium">{job.customer_complaint}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        {total > 0 && <div className="text-lg font-black text-white">{fmt(total)}</div>}
                        {job.amount_paid > 0 && <div className="text-xs text-green-400">Paid: {fmt(job.amount_paid)}</div>}
                        <div className="text-slate-600 text-xs mt-1">{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-3">
                      {job.tech_diagnosis && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Tech Diagnosis</p>
                          <p className="text-slate-300 text-sm font-mono bg-slate-950 p-3 rounded">{job.tech_diagnosis}</p>
                        </div>
                      )}
                      <div className="flex gap-3 pt-2">
                        <Link href={`/jobs/${job.id}`}>
                          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded">Open Ticket →</button>
                        </Link>
                        <Link href={`/jobs/${job.id}/invoice`}>
                          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded">View Invoice</button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Other vehicles for same customer */}
        {otherVehicles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2 pt-4 border-t border-slate-800">
              👤 Other Vehicles — Same Customer
            </h2>
            {otherVehicles.map(job => (
              <div key={job.id} className="bg-slate-900/50 rounded-lg border border-slate-800 hover:border-slate-700 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-200">{job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{job.vehicles?.vin}</p>
                    <p className="text-slate-400 text-sm mt-2">{job.customer_complaint}</p>
                    <p className="text-xs text-slate-600 mt-1">{new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/jobs/${job.id}`}>
                    <button className="text-xs text-indigo-400 hover:text-white border border-indigo-500/30 px-3 py-1.5 rounded bg-indigo-500/10 ml-4">View →</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}