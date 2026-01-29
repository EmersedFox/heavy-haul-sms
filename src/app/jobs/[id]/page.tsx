'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'


// 1. GENERAL ITEMS (Updated with Clutch)
const GENERAL_CHECKLISTS: any = {
  car: [
    'Lights (Head/Tail/Brake)', 'Wipers & Washers', 'Horn', 
    'Brake Pads/Rotors', 'Fluid Levels', 'Battery Health', 
    'Belts & Hoses', 'Suspension Components', 'Exhaust System', 
    'Clutch / Transmission', 
    'Dashboard Warning Lights'
  ],
  heavy_truck: [
    'Air Brake System (Leak Down)', 'Air Lines / Gladhands', 
    'Kingpin / 5th Wheel Lock', 'Springs / Air Bags', 'Steering Linkage', 
    'Lights & Reflectors', 'Fluid Levels (Oil/Coolant/DEF)', 
    'Clutch / Transmission', 
    'Belts & Hoses', 'Exhaust / DPF', 'Mudflaps', 
    'City Horn / Air Horn', 'Fire Extinguisher / Triangles'
  ],
  trailer: [
    'Gladhands / Seals', 'Landing Gear / Crank', 'Floor / Decking Condition', 
    'Side Panels / Roof', 'Lights / Markers / ABS Light', 'Air Lines / Hoses', 
    'Brake Shoes / Drums', 'Slack Adjusters', 'Springs / Air Bags', 
    'Mudflaps', 'ICC Bar / Bumper'
  ]
}

// 2. TIRE CONFIGS
const TIRE_CONFIGS: any = {
  car: [
    'LF (Left Front)', 'RF (Right Front)', 'LR (Left Rear)', 'RR (Right Rear)', 'Spare'
  ],
  heavy_truck: [
    'LF (Steer)', 'RF (Steer)', 
    '1LRO', '1LRI', '1RRI', '1RRO', 
    '2LRO', '2LRI', '2RRI', '2RRO', 
    '3LRO', '3LRI', '3RRI', '3RRO'
  ],
  trailer: [
    '1LRO', '1LRI', '1RRI', '1RRO', 
    '2LRO', '2LRI', '2RRI', '2RRO', 
    '3LRO', '3LRI', '3RRI', '3RRO'
  ]
}

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
  const [isArchived, setIsArchived] = useState(false)
  
  // Permissions State
  const [userRole, setUserRole] = useState('')

  // Inspection State
  const [inspection, setInspection] = useState<any>({})
  const [showInspection, setShowInspection] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // 1. Get User Role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'technician')

      // 2. Fetch Job + Vehicle
      const { data: jobData } = await supabase
        .from('jobs')
        .select(`*, vehicles (*, customers (*))`)
        .eq('id', id)
        .single()

      if (!jobData) throw new Error('Job not found')

      // 3. Fetch Existing Inspection
      const { data: inspData } = await supabase.from('inspections').select('checklist').eq('job_id', id).single()

      // 4. Fetch Roster
      const { data: profileData } = await supabase.from('profiles').select('id, first_name, last_name').order('first_name')

      setJob(jobData)
      setNotes(jobData.tech_diagnosis || '')
      setStatus(jobData.status)
      setIsArchived(jobData.is_archived || false)
      if (profileData) setTechs(profileData)
	  document.title = `Ticket #${jobData.id.slice(0, 8)} | Heavy Haul Auto`

      // 5. SMART MERGE (Self-Healing Checklist)
      const type = jobData.vehicles.vehicle_type || 'car'
      const allItems = [...(GENERAL_CHECKLISTS[type] || GENERAL_CHECKLISTS.car), ...(TIRE_CONFIGS[type] || TIRE_CONFIGS.car)]
      const saved = inspData?.checklist || {}
      const final: any = {}
      
      allItems.forEach(item => {
        // If saved data exists, use it. If not, create blank entry.
        final[item] = saved[item] || { status: 'pending', note: '' }
      })

      setInspection(final)
      setLoading(false)

    } catch (error) {
      console.error(error)
      router.push('/dashboard')
    }
  }, [id, router])

  useEffect(() => { fetchData() }, [fetchData])

  // --- ACTIONS ---

  const handleSave = async () => {
    setSaving(true)
    // Save Job Details
    await supabase.from('jobs').update({ tech_diagnosis: notes, status: status }).eq('id', id)
    // Save Inspection
    await supabase.from('inspections').upsert(
      { job_id: id, checklist: inspection, updated_at: new Date() }, 
      { onConflict: 'job_id' }
    )
    setSaving(false)
  }

  const handleAssignTech = async (val: string) => {
    const techId = val === '' ? null : val
    setJob({ ...job, assigned_tech_id: techId }) // Optimistic Update
    await supabase.from('jobs').update({ assigned_tech_id: techId }).eq('id', id)
  }

  const handleArchive = async () => {
    const newValue = !isArchived
    // Confirmation before archiving
    if (newValue === true && !confirm('Are you sure you want to Archive this job? It will be hidden from the main dashboard.')) {
      return
    }
    await supabase.from('jobs').update({ is_archived: newValue }).eq('id', id)
    setIsArchived(newValue)
    if (newValue) router.push('/dashboard') // Redirect on Archive
  }

  const copyPublicLink = () => {
    const url = `${window.location.origin}/public/inspection/${id}`
    navigator.clipboard.writeText(url)
    alert('Public Link Copied!\nSend this to the customer:\n\n' + url)
  }

  // --- INSPECTION HELPERS ---

  const toggleItem = (item: string, newStatus: string) => {
    setInspection({ ...inspection, [item]: { ...inspection[item], status: newStatus } })
  }

  const updateNote = (item: string, text: string) => {
    setInspection({ ...inspection, [item]: { ...inspection[item], note: text } })
  }

  // --- PERMISSION CHECKS ---
  const canAssign = userRole === 'admin' || userRole === 'advisor'
  const canViewInvoice = userRole === 'admin' || userRole === 'advisor'
  const type = job?.vehicles?.vehicle_type || 'car'

  if (loading) return <div className="p-10 text-white bg-slate-950 min-h-screen">Loading Ticket...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
        <div>
          <div className="flex items-center gap-3">
             <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">WORK ORDER</span>
             <span className="text-slate-400 text-sm font-mono">#{job.id.slice(0, 8)}</span>
             {isArchived && <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-1 rounded">ARCHIVED</span>}
          </div>
          <h1 className="text-2xl font-bold mt-1">
            {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
          </h1>
        </div>
        
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            Back
          </Link>
          
          {/* SHARE BUTTON */}
          <button 
            onClick={copyPublicLink} 
            className="px-3 py-2 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 rounded flex items-center gap-2" 
            title="Copy Link for Customer"
          >
            🔗 Share
          </button>

          {/* PRINT BUTTON */}
          <Link href={`/jobs/${id}/print-inspection`}>
            <button className="px-3 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 hover:text-white" title="Print Inspection Report">
              🖨️ Insp.
            </button>
          </Link>

          {/* INVOICE BUTTON (Hidden for Techs) */}
          {canViewInvoice && (
            <Link href={`/jobs/${id}/invoice`}>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg">
                 Invoice $$
              </button>
            </Link>
          )}

          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded shadow-lg">
            {saving ? 'Saving...' : 'Save Work'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: CONTROLS */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 space-y-5">
            
            {/* 1. STATUS */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Job Status</h3>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded focus:ring-2 focus:ring-amber-500 outline-none">
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_shop">In Shop</option>
                <option value="waiting_parts">Waiting on Parts</option>
                <option value="ready">Ready for Pickup</option>
                <option value="invoiced">Invoiced / Closed</option>
              </select>
            </div>

            {/* 2. ARCHIVE BUTTON (Admin/Advisor only) */}
            {canAssign && (
              <div className="pt-2 border-t border-slate-800">
                {isArchived ? (
                   <button onClick={handleArchive} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-sm transition-colors">
                     📂 Restore to Dashboard
                   </button>
                ) : (
                   <button onClick={handleArchive} className="w-full py-2 bg-transparent border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 rounded font-bold text-sm transition-colors">
                     🗄️ Archive Job
                   </button>
                )}
              </div>
            )}

            {/* 3. ASSIGN TECH (Locked for Techs) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-xs font-bold text-slate-400 uppercase">Assigned Technician</h3>
                 {!canAssign && <span className="text-xs text-slate-500">🔒 Locked</span>}
              </div>
              <select 
                  value={job.assigned_tech_id || ''} 
                  onChange={(e) => handleAssignTech(e.target.value)}
                  disabled={!canAssign}
                  className={`w-full bg-slate-950 border border-slate-700 text-white p-3 rounded outline-none ${canAssign ? 'focus:ring-2 focus:ring-indigo-500' : 'opacity-50 cursor-not-allowed bg-slate-900'}`}
              >
                  <option value="">-- Unassigned --</option>
                  {techs.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
            </div>
          </div>

          {/* VEHICLE CARD */}
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 relative group">
            <div className="flex justify-between items-center mb-3">
               <h3 className="text-sm font-bold text-slate-400 uppercase">Vehicle & Customer</h3>
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
               <p className="text-slate-500">Type:</p>
               <span className="text-xs font-bold uppercase bg-slate-800 px-2 py-1 rounded">{job.vehicles.vehicle_type?.replace('_', ' ') || 'CAR'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TABS */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="flex border-b border-slate-800 mb-4">
            <button 
              onClick={() => setShowInspection(false)} 
              className={`px-6 py-3 font-bold text-sm ${!showInspection ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'}`}
            >
              Diagnosis & Notes
            </button>
            <button 
              onClick={() => setShowInspection(true)} 
              className={`px-6 py-3 font-bold text-sm ${showInspection ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'}`}
            >
              Inspection Checklist
            </button>
          </div>

          {/* TAB 1: DIAGNOSIS */}
          {!showInspection ? (
             <div className="space-y-6">
               <div className="bg-red-900/10 border border-red-900/30 p-5 rounded-lg">
                 <h3 className="text-red-400 text-sm font-bold uppercase mb-2">Customer Complaint</h3>
                 <p className="text-slate-200">{job.customer_complaint}</p>
               </div>
               <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 h-96 flex flex-col">
                 <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Technician Diagnosis</h3>
                 <textarea 
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   className="flex-grow bg-slate-950 border border-slate-700 rounded p-4 text-white focus:border-amber-500 outline-none font-mono"
                   placeholder="Technician notes..."
                 />
               </div>
             </div>
          ) : (
            /* TAB 2: INSPECTION */
             <div className="space-y-8">
               
               {/* SECTION 1: GENERAL INSPECTION */}
               <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>🔍</span> General Inspection
                 </h3>
                 <div className="space-y-4">
                   {(GENERAL_CHECKLISTS[type] || GENERAL_CHECKLISTS.car).map((item: string) => inspection[item] && (
                     <div key={item} className="p-3 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-200">{item}</span>
                          <div className="flex gap-2">
                             <button onClick={() => toggleItem(item, 'pass')} className={`px-3 py-1 rounded text-xs font-bold border ${inspection[item].status === 'pass' ? 'bg-green-500/20 text-green-400 border-green-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>GOOD</button>
                             <button onClick={() => toggleItem(item, 'fail')} className={`px-3 py-1 rounded text-xs font-bold border ${inspection[item].status === 'fail' ? 'bg-red-500/20 text-red-400 border-red-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>BAD</button>
                             <button onClick={() => toggleItem(item, 'na')} className={`px-3 py-1 rounded text-xs font-bold border ${inspection[item].status === 'na' ? 'bg-slate-700 text-slate-300 border-slate-600' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>N/A</button>
                          </div>
                        </div>
                        
                        {/* CONDITIONAL NOTE INPUT (Appears if BAD) */}
                        {inspection[item].status === 'fail' && (
                          <input 
                            type="text" 
                            placeholder="Reason for failure..." 
                            value={inspection[item].note || ''}
                            onChange={(e) => updateNote(item, e.target.value)}
                            className="mt-3 w-full bg-red-900/10 border border-red-900/30 rounded p-2 text-sm text-red-200 placeholder-red-400/50 outline-none focus:border-red-500"
                          />
                        )}
                     </div>
                   ))}
                 </div>
               </div>

               {/* SECTION 2: TIRE STATION */}
               <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                 <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>🛞</span> Tire Station
                 </h3>
                 <p className="text-xs text-slate-500 mb-6">Mark missing axles/tires as N/A</p>
                 
                 <div className="space-y-2">
                   {(TIRE_CONFIGS[type] || TIRE_CONFIGS.car).map((item: string) => inspection[item] && (
                     <div key={item} className="p-2 border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-sm text-slate-300">{item}</span>
                          <div className="flex gap-2">
                             <button onClick={() => toggleItem(item, 'pass')} className={`w-12 py-1 rounded text-xs font-bold border ${inspection[item].status === 'pass' ? 'bg-green-500/20 text-green-400 border-green-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>OK</button>
                             <button onClick={() => toggleItem(item, 'fail')} className={`w-12 py-1 rounded text-xs font-bold border ${inspection[item].status === 'fail' ? 'bg-red-500/20 text-red-400 border-red-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>BAD</button>
                             <button onClick={() => toggleItem(item, 'na')} className={`w-10 py-1 rounded text-xs font-bold border ${inspection[item].status === 'na' ? 'bg-slate-700 text-slate-300 border-slate-600' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>N/A</button>
                          </div>
                        </div>

                        {/* CONDITIONAL NOTE INPUT FOR TIRES */}
                        {inspection[item].status === 'fail' && (
                          <input 
                            type="text" 
                            placeholder="e.g. 2/32 tread, sidewall cut" 
                            value={inspection[item].note || ''}
                            onChange={(e) => updateNote(item, e.target.value)}
                            className="mt-2 w-full bg-red-900/10 border border-red-900/30 rounded p-2 text-xs text-red-200 placeholder-red-400/50 outline-none focus:border-red-500"
                          />
                        )}
                     </div>
                   ))}
                 </div>
               </div>

             </div>
          )}

        </div>
      </div>
    </div>
  )
}