'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function JobTicketPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data State
  const [job, setJob] = useState<any>(null)
  const [techs, setTechs] = useState<any[]>([]) 
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  
  // Permissions State
  const [userRole, setUserRole] = useState('') // <--- NEW

  const fetchData = useCallback(async () => {
    try {
      // 1. Get Current User & Role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const role = profile?.role || 'technician'
      setUserRole(role)

      // 2. Fetch Job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          vehicles (
            year, make, model, vin, unit_number,
            customers (first_name, last_name, phone, company_name)
          )
        `)
        .eq('id', id)
        .single()

      if (jobError || !jobData) throw jobError

      // 3. Fetch Roster
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name', { ascending: true })

      setJob(jobData)
      setNotes(jobData.tech_diagnosis || '')
      setStatus(jobData.status)
      if (profileData) setTechs(profileData)
      
      setLoading(false)

    } catch (error) {
      console.error('Error loading ticket:', error)
      router.push('/dashboard')
    }
  }, [id, router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('jobs').update({ tech_diagnosis: notes, status: status }).eq('id', id)
    setSaving(false)
  }

  const handleAssignTech = async (techId: string) => {
    const val = techId === '' ? null : techId
    setJob({ ...job, assigned_tech_id: val })
    await supabase.from('jobs').update({ assigned_tech_id: val }).eq('id', id)
  }

  // Helper to check if they can assign (Admin OR Advisor)
  const canAssign = userRole === 'admin' || userRole === 'advisor'

  if (loading) return <div className="p-10 text-white bg-slate-950 min-h-screen">Loading Ticket...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div>
          <div className="flex items-center gap-3">
             <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">WORK ORDER</span>
             <span className="text-slate-400 text-sm font-mono">#{job.id.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">
            {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
          </h1>
        </div>
        
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            Back
          </Link>
          <Link href={`/jobs/${id}/invoice`}>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg">
               Go to Invoice $$
            </button>
          </Link>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded shadow-lg">
            {saving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 space-y-5">
            
            {/* Status (Everyone can edit status) */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Job Status</h3>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_shop">In Shop</option>
                <option value="waiting_parts">Waiting on Parts</option>
                <option value="ready">Ready for Pickup</option>
                <option value="invoiced">Invoiced / Closed</option>
              </select>
            </div>

            {/* Assigned Tech (LOCKED FOR TECHS) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-xs font-bold text-slate-400 uppercase">Assigned Technician</h3>
                 {!canAssign && <span className="text-xs text-slate-500">🔒 Locked</span>}
              </div>
              
              <select 
                  value={job.assigned_tech_id || ''} 
                  onChange={(e) => handleAssignTech(e.target.value)}
                  disabled={!canAssign} // <--- THE LOCK
                  className={`w-full bg-slate-950 border border-slate-700 text-white p-3 rounded outline-none ${
                    canAssign ? 'focus:ring-2 focus:ring-indigo-500' : 'opacity-50 cursor-not-allowed bg-slate-900'
                  }`}
              >
                  <option value="">-- Unassigned --</option>
                  {techs.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name ? `${t.first_name} ${t.last_name}` : t.email}
                    </option>
                  ))}
              </select>
            </div>

          </div>

          {/* Vehicle Info */}
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 relative group">
            <div className="flex justify-between items-center mb-3">
               <h3 className="text-sm font-bold text-slate-400 uppercase">Vehicle & Customer</h3>
               {/* Allow edits for Advisors too */}
               {canAssign && (
                 <Link href={`/jobs/${id}/edit`} className="text-indigo-400 hover:text-white text-xs font-bold border border-indigo-500/30 px-2 py-1 rounded bg-indigo-500/10">
                    ✎ EDIT INFO
                 </Link>
               )}
            </div>
            
            <div className="space-y-2 text-sm">
               <p><span className="text-slate-500">Owner:</span> {job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
               <p><span className="text-slate-500">Phone:</span> {job.vehicles.customers.phone}</p>
               <div className="h-px bg-slate-800 my-2"></div>
               <p><span className="text-slate-500">Vehicle:</span> {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
               <p><span className="text-slate-500">VIN:</span> <span className="font-mono">{job.vehicles.vin}</span></p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-red-900/10 border border-red-900/30 p-5 rounded-lg">
            <h3 className="text-red-400 text-sm font-bold uppercase mb-2">Complaint</h3>
            <p className="text-slate-200">{job.customer_complaint}</p>
          </div>

          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 h-96 flex flex-col">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Technician Diagnosis & Notes</h3>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-grow bg-slate-950 border border-slate-700 rounded p-4 text-white focus:border-amber-500 outline-none font-mono"
              placeholder="Technician notes..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}