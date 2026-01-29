'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

// 1. GENERAL ITEMS
const GENERAL_CHECKLISTS: any = {
  car: ['Lights (Head/Tail/Brake)', 'Wipers & Washers', 'Horn', 'Brake Pads/Rotors', 'Fluid Levels', 'Battery Health', 'Belts & Hoses', 'Suspension Components', 'Exhaust System', 'Clutch / Transmission', 'Dashboard Warning Lights'],
  heavy_truck: ['Air Brake System (Leak Down)', 'Air Lines / Gladhands', 'Kingpin / 5th Wheel Lock', 'Springs / Air Bags', 'Steering Linkage', 'Lights & Reflectors', 'Fluid Levels (Oil/Coolant/DEF)', 'Clutch / Transmission', 'Belts & Hoses', 'Exhaust / DPF', 'Mudflaps', 'City Horn / Air Horn', 'Fire Extinguisher / Triangles'],
  trailer: ['Gladhands / Seals', 'Landing Gear / Crank', 'Floor / Decking Condition', 'Side Panels / Roof', 'Lights / Markers / ABS Light', 'Air Lines / Hoses', 'Brake Shoes / Drums', 'Slack Adjusters', 'Springs / Air Bags', 'Mudflaps', 'ICC Bar / Bumper']
}

// 2. TIRE CONFIGS
const TIRE_CONFIGS: any = {
  car: ['LF (Left Front)', 'RF (Right Front)', 'LR (Left Rear)', 'RR (Right Rear)', 'Spare'],
  heavy_truck: ['LF (Steer)', 'RF (Steer)', '1LRO', '1LRI', '1RRI', '1RRO', '2LRO', '2LRI', '2RRI', '2RRO', '3LRO', '3LRI', '3RRI', '3RRO'],
  trailer: ['1LRO', '1LRI', '1RRI', '1RRO', '2LRO', '2LRI', '2RRI', '2RRO', '3LRO', '3LRI', '3RRI', '3RRO']
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
  const [userRole, setUserRole] = useState('')

  // Inspection State
  const [inspection, setInspection] = useState<any>({})
  const [recommendations, setRecommendations] = useState<any>({})
  const [showInspection, setShowInspection] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'technician')

      const { data: jobData } = await supabase.from('jobs').select(`*, vehicles (*, customers (*))`).eq('id', id).single()
      if (!jobData) throw new Error('Job not found')

      const { data: inspData } = await supabase.from('inspections').select('checklist, recommendations').eq('job_id', id).single()
      const { data: profileData } = await supabase.from('profiles').select('id, first_name, last_name').order('first_name')

      setJob(jobData)
      setNotes(jobData.tech_diagnosis || '')
      setStatus(jobData.status)
      setIsArchived(jobData.is_archived || false)
      if (profileData) setTechs(profileData)

      document.title = `Ticket #${jobData.id.slice(0, 8)} | Heavy Haul Auto`

      const type = jobData.vehicles.vehicle_type || 'car'
      const allItems = [...(GENERAL_CHECKLISTS[type] || GENERAL_CHECKLISTS.car), ...(TIRE_CONFIGS[type] || TIRE_CONFIGS.car)]
      const savedChecklist = inspData?.checklist || {}
      const savedRecs = inspData?.recommendations || {}
      
      const finalChecklist: any = {}
      const finalRecs: any = {}

      allItems.forEach(item => {
        finalChecklist[item] = savedChecklist[item] || { status: 'pending', note: '' }
        finalRecs[item] = savedRecs[item] || { service: '', parts: 0, labor: 0, decision: 'pending', noCost: false }
      })

      setInspection(finalChecklist)
      setRecommendations(finalRecs)
      setLoading(false)

    } catch (error) {
      console.error(error)
      router.push('/dashboard')
    }
  }, [id, router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    
    // Update Job
    const { error: jobError } = await supabase.from('jobs').update({ tech_diagnosis: notes, status: status }).eq('id', id)
    if (jobError) { alert('Error saving status: ' + jobError.message); setSaving(false); return }

    // Update Inspection
    await supabase.from('inspections').upsert(
      { 
        job_id: id, 
        checklist: inspection, 
        recommendations: recommendations, 
        updated_at: new Date() 
      }, 
      { onConflict: 'job_id' }
    )
    setSaving(false)
  }

  const handleAssignTech = async (val: string) => {
    const techId = val === '' ? null : val
    setJob({ ...job, assigned_tech_id: techId })
    await supabase.from('jobs').update({ assigned_tech_id: techId }).eq('id', id)
  }

  const handleArchive = async () => {
    const newValue = !isArchived
    if (newValue === true && !confirm('Archive this job?')) return
    await supabase.from('jobs').update({ is_archived: newValue }).eq('id', id)
    setIsArchived(newValue)
    if (newValue) router.push('/dashboard')
  }

  const copyPublicLink = () => {
    const url = `${window.location.origin}/public/inspection/${id}`
    navigator.clipboard.writeText(url)
    alert('Public Link Copied!\nSend this to the customer:\n\n' + url)
  }

  // --- HELPERS ---
  const toggleItem = (item: string, newStatus: string) => {
    setInspection({ ...inspection, [item]: { ...inspection[item], status: newStatus } })
  }

  const updateNote = (item: string, text: string) => {
    setInspection({ ...inspection, [item]: { ...inspection[item], note: text } })
  }

  const updateRec = (item: string, field: string, value: any) => {
    let newData = { ...recommendations[item], [field]: value }
    if (field === 'noCost' && value === true) { newData.parts = 0; newData.labor = 0 }
    setRecommendations({ ...recommendations, [item]: newData })
  }

  const canAssign = userRole === 'admin' || userRole === 'advisor'
  const canViewInvoice = userRole === 'admin' || userRole === 'advisor'
  const type = job?.vehicles?.vehicle_type || 'car'

  // --- RENDERERS ---

  const renderRecommendationBox = (item: string) => {
    if (inspection[item].status !== 'fail') return null
    
    const rec = recommendations[item] || { decision: 'pending', noCost: false }
    const isEditable = userRole === 'admin' || userRole === 'advisor'
    
    let borderClass = 'border-indigo-500/30'
    let bgClass = 'bg-slate-900'
    if (rec.decision === 'approved') { borderClass = 'border-green-500'; bgClass = 'bg-green-900/10' }
    if (rec.decision === 'denied') { borderClass = 'border-red-500/50'; bgClass = 'bg-red-900/10' }

    return (
      <div className={`mt-3 ${bgClass} border ${borderClass} rounded p-3 ml-4 relative transition-colors`}>
        <div className={`absolute -left-2 top-3 w-2 h-2 border-l border-b ${borderClass} bg-slate-950 rotate-45`}></div>
        
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
            <span>🛠️</span> Recommendation & Estimate
          </h4>
          
          <div className="flex items-center gap-2">
            {rec.decision === 'approved' && <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-1 rounded">APPROVED</span>}
            {rec.decision === 'denied' && <span className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded">DENIED</span>}
            {rec.decision === 'pending' && <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">PENDING</span>}
            
            {isEditable && (
              <div className="flex gap-1 ml-2 border-l border-slate-700 pl-2">
                <button onClick={() => updateRec(item, 'decision', 'approved')} title="Mark Approved (Phone)" className="text-xs opacity-50 hover:opacity-100 hover:text-green-400">✅</button>
                <button onClick={() => updateRec(item, 'decision', 'denied')} title="Mark Denied (Phone)" className="text-xs opacity-50 hover:opacity-100 hover:text-red-400">❌</button>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-6">
             <input type="text" placeholder="Recommended Service..." value={rec.service || ''} onChange={(e) => updateRec(item, 'service', e.target.value)} disabled={!isEditable} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500" />
          </div>
          <div className="md:col-span-2 flex items-center justify-center bg-slate-950 border border-slate-700 rounded p-2">
             <label className="text-xs font-bold text-slate-400 flex items-center gap-2 cursor-pointer select-none">
               <input type="checkbox" checked={rec.noCost || false} onChange={(e) => updateRec(item, 'noCost', e.target.checked)} disabled={!isEditable} className="accent-green-500" />
               NO CHARGE
             </label>
          </div>
          <div className="md:col-span-2 relative">
             <span className={`absolute left-2 top-2 text-xs ${rec.noCost ? 'text-slate-700' : 'text-slate-500'}`}>$</span>
             <input type="number" placeholder="Parts" value={rec.parts || ''} onChange={(e) => updateRec(item, 'parts', parseFloat(e.target.value) || 0)} disabled={!isEditable || rec.noCost} className={`w-full bg-slate-950 border border-slate-700 rounded p-2 pl-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 ${rec.noCost && 'opacity-30 cursor-not-allowed'}`} />
          </div>
          <div className="md:col-span-2 relative">
             <span className={`absolute left-2 top-2 text-xs ${rec.noCost ? 'text-slate-700' : 'text-slate-500'}`}>$</span>
             <input type="number" placeholder="Labor" value={rec.labor || ''} onChange={(e) => updateRec(item, 'labor', parseFloat(e.target.value) || 0)} disabled={!isEditable || rec.noCost} className={`w-full bg-slate-950 border border-slate-700 rounded p-2 pl-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 ${rec.noCost && 'opacity-30 cursor-not-allowed'}`} />
          </div>
        </div>
      </div>
    )
  }

  const getApprovedItems = () => {
    return Object.keys(recommendations).filter(key => recommendations[key].decision === 'approved')
  }

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
          <h1 className="text-2xl font-bold mt-1">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</h1>
        </div>
        
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Back</Link>
          <button onClick={copyPublicLink} className="px-3 py-2 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 rounded flex items-center gap-2">🔗 Share</button>
          <Link href={`/jobs/${id}/print-inspection`}><button className="px-3 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 hover:text-white">🖨️ Insp.</button></Link>
          {canViewInvoice && <Link href={`/jobs/${id}/invoice`}><button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg">Invoice $$</button></Link>}
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded shadow-lg">{saving ? 'Saving...' : 'Save Work'}</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Job Status</h3>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded focus:ring-2 focus:ring-amber-500 outline-none">
                <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="in_shop">In Shop</option>
                <option value="waiting_approval">Waiting On Approval</option>
                <option value="waiting_parts">Waiting on Parts</option><option value="ready">Ready for Pickup</option><option value="invoiced">Invoiced / Closed</option>
              </select>
            </div>
            {canAssign && (
              <div className="pt-2 border-t border-slate-800">
                {isArchived ? <button onClick={handleArchive} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-sm">📂 Restore</button> : <button onClick={handleArchive} className="w-full py-2 bg-transparent border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 rounded font-bold text-sm">🗄️ Archive</button>}
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-slate-400 uppercase">Assigned Technician</h3>{!canAssign && <span className="text-xs text-slate-500">🔒 Locked</span>}</div>
              <select value={job.assigned_tech_id || ''} onChange={(e) => handleAssignTech(e.target.value)} disabled={!canAssign} className={`w-full bg-slate-950 border border-slate-700 text-white p-3 rounded outline-none ${canAssign ? 'focus:ring-2 focus:ring-indigo-500' : 'opacity-50 cursor-not-allowed bg-slate-900'}`}><option value="">-- Unassigned --</option>{techs.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}</select>
            </div>
          </div>
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 relative group">
            <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-slate-400 uppercase">Vehicle & Customer</h3>{canAssign && <Link href={`/jobs/${id}/edit`} className="text-indigo-400 hover:text-white text-xs font-bold border border-indigo-500/30 px-2 py-1 rounded bg-indigo-500/10">✎ EDIT INFO</Link>}</div>
            <div className="space-y-2 text-sm">
               <p><span className="text-slate-500">Owner:</span> {job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
               <p><span className="text-slate-500">Phone:</span> {job.vehicles.customers.phone}</p>
               <div className="h-px bg-slate-800 my-2"></div>
               <p><span className="text-slate-500">Vehicle:</span> {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
               <p><span className="text-slate-500">VIN:</span> <span className="font-mono">{job.vehicles.vin}</span></p>
               <p className="text-slate-500">Type:</p> <span className="text-xs font-bold uppercase bg-slate-800 px-2 py-1 rounded">{job.vehicles.vehicle_type?.replace('_', ' ') || 'CAR'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex border-b border-slate-800 mb-4">
            <button onClick={() => setShowInspection(false)} className={`px-6 py-3 font-bold text-sm ${!showInspection ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'}`}>Diagnosis & Notes</button>
            <button onClick={() => setShowInspection(true)} className={`px-6 py-3 font-bold text-sm ${showInspection ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'}`}>Inspection Checklist</button>
          </div>

          {!showInspection ? (
             <div className="space-y-6">
               <div className="bg-red-900/10 border border-red-900/30 p-5 rounded-lg"><h3 className="text-red-400 text-sm font-bold uppercase mb-2">Customer Complaint</h3><p className="text-slate-200">{job.customer_complaint}</p></div>
               <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 h-96 flex flex-col"><h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Technician Diagnosis</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-grow bg-slate-950 border border-slate-700 rounded p-4 text-white focus:border-amber-500 outline-none font-mono" placeholder="Technician notes..." /></div>
             </div>
          ) : (
             <div className="space-y-8">
               
               {/* APPROVED WORK SUMMARY */}
               {getApprovedItems().length > 0 && (
                 <div className="bg-green-900/10 border border-green-500/30 p-6 rounded-lg animate-pulse-slow">
                   <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2"><span>✅</span> APPROVED WORK - TO DO LIST</h3>
                   <div className="space-y-3">
                     {getApprovedItems().map(key => (
                       <div key={key} className="flex justify-between items-center bg-slate-950 p-3 rounded border border-green-500/20">
                         <div><span className="font-bold text-white block">{recommendations[key].service}</span><span className="text-xs text-slate-500 uppercase">Ref: {key}</span></div>
                         <div className="text-green-500 font-bold text-sm">APPROVED</div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* SECTION 1: GENERAL INSPECTION (Note only on Fail) */}
               <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                 <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><span>🔍</span> General Inspection</h3>
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
                        {inspection[item].status === 'fail' && (
                          <div className="space-y-2">
                            <input type="text" placeholder="Reason for failure..." value={inspection[item].note || ''} onChange={(e) => updateNote(item, e.target.value)} className="mt-3 w-full bg-red-900/10 border border-red-900/30 rounded p-2 text-sm text-red-200 placeholder-red-400/50 outline-none focus:border-red-500" />
                            {renderRecommendationBox(item)}
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
               </div>

               {/* SECTION 2: TIRE STATION (Always Show Note) */}
               <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                 <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><span>🛞</span> Tire Station</h3>
                 <p className="text-xs text-slate-500 mb-6">Record Tread Depth & PSI for all tires.</p>
                 <div className="space-y-2">
                   {(TIRE_CONFIGS[type] || TIRE_CONFIGS.car).map((item: string) => inspection[item] && (
                     <div key={item} className="p-3 border border-slate-800 rounded bg-slate-950 mb-3 last:mb-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono text-sm text-slate-300 font-bold">{item}</span>
                          <div className="flex gap-2">
                             <button onClick={() => toggleItem(item, 'pass')} className={`w-12 py-1 rounded text-xs font-bold border ${inspection[item].status === 'pass' ? 'bg-green-500/20 text-green-400 border-green-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>OK</button>
                             <button onClick={() => toggleItem(item, 'fail')} className={`w-12 py-1 rounded text-xs font-bold border ${inspection[item].status === 'fail' ? 'bg-red-500/20 text-red-400 border-red-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>BAD</button>
                             <button onClick={() => toggleItem(item, 'na')} className={`w-10 py-1 rounded text-xs font-bold border ${inspection[item].status === 'na' ? 'bg-slate-700 text-slate-300 border-slate-600' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>N/A</button>
                          </div>
                        </div>
                        
                        {/* TIRE INPUT (ALWAYS VISIBLE) */}
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-xs text-slate-500 pointer-events-none">DATA:</span>
                           <input 
                             type="text" 
                             placeholder="e.g. 10/32 100psi" 
                             value={inspection[item].note || ''} 
                             onChange={(e) => updateNote(item, e.target.value)} 
                             className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-12 text-sm text-white focus:border-indigo-500 outline-none" 
                           />
                        </div>

                        {/* RECOMMENDATION (If Failed) */}
                        {inspection[item].status === 'fail' && renderRecommendationBox(item)}
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