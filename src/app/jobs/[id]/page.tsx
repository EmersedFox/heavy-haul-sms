'use client'
import { useEffect, useState, useCallback } from 'react'
import { getSellPrice, getMarkupPct, type ShopSettings } from '@/lib/markup'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const generateId = () => Math.random().toString(36).substr(2, 9)

const GENERAL_CHECKLISTS: any = {
  car: ['Lights (Head/Tail/Brake)', 'Wipers & Washers', 'Horn', 'Brake Pads/Rotors', 'Fluid Levels', 'Battery Health', 'Belts & Hoses', 'Suspension Components', 'Exhaust System', 'Clutch / Transmission', 'Dashboard Warning Lights'],
  heavy_truck: ['Air Brake System (Leak Down)', 'Air Lines / Gladhands', 'Kingpin / 5th Wheel Lock', 'Springs / Air Bags', 'Steering Linkage', 'Lights & Reflectors', 'Fluid Levels (Oil/Coolant/DEF)', 'Clutch / Transmission', 'Belts & Hoses', 'Exhaust / DPF', 'Mudflaps', 'City Horn / Air Horn', 'Fire Extinguisher / Triangles'],
  trailer: ['Gladhands / Seals', 'Landing Gear / Crank', 'Floor / Decking Condition', 'Side Panels / Roof', 'Lights / Markers / ABS Light', 'Air Lines / Hoses', 'Brake Shoes / Drums', 'Slack Adjusters', 'Springs / Air Bags', 'Mudflaps', 'ICC Bar / Bumper']
}
const TIRE_CONFIGS: any = {
  car: ['LF (Left Front)', 'RF (Right Front)', 'LR (Left Rear)', 'RR (Right Rear)', 'Spare'],
  heavy_truck: ['LF (Steer)', 'RF (Steer)', '1LRO', '1LRI', '1RRI', '1RRO', '2LRO', '2LRI', '2RRI', '2RRO', '3LRO', '3LRI', '3RRI', '3RRO'],
  trailer: ['1LRO', '1LRI', '1RRI', '1RRO', '2LRO', '2LRI', '2RRI', '2RRO', '3LRO', '3LRI', '3RRI', '3RRO']
}

const fmt = (n: any) => `$${(Math.round((Number(n)||0)*100)/100).toFixed(2)}`
const fmtMins = (m: number) => m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`

type Tab = 'diagnosis' | 'inspection' | 'payment' | 'parts_orders' | 'time' | 'history'

export default function JobTicketPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [loading, setSaving_] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [job,        setJob]        = useState<any>(null)
  const [techs,      setTechs]      = useState<any[]>([])
  const [notes,      setNotes]      = useState('')
  const [status,     setStatus]     = useState('')
  const [odometer,   setOdometer]   = useState('')
  const [isArchived, setIsArchived] = useState(false)
  const [userRole,   setUserRole]   = useState('')
  const [userId,     setUserId]     = useState('')
  const [userName,   setUserName]   = useState('')
  const [sessionToken, setSessionToken] = useState('')

  const [shopSettings, setShopSettings] = useState<any>({ labor_rate: 120, parts_markup_retail: 30, parts_markup_commercial: 20, tax_rate: 7 })

  const [inspection,     setInspection]     = useState<any>({})
  const [recommendations, setRecommendations] = useState<any>({})
  const [serviceJobs,    setServiceJobs]    = useState<any[]>([])

  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentNotes,  setPaymentNotes]  = useState('')
  const [amountPaid,    setAmountPaid]    = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const [timeEntries,   setTimeEntries]   = useState<any[]>([])
  const [clockedInEntry, setClockedInEntry] = useState<any>(null)
  const [timeNotes,     setTimeNotes]     = useState('')
  const [clockLoading,  setClockLoading]  = useState(false)

  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [showPOForm,     setShowPOForm]     = useState(false)
  const [poForm, setPoForm] = useState({ vendor: '', expectedDate: '', notes: '', items: [{ id: generateId(), partNumber: '', name: '', qty: 1, unitCost: 0 }] })
  const [savingPO, setSavingPO] = useState(false)

  const [events, setEvents] = useState<any[]>([])

  const [activeTab, setActiveTab]         = useState<Tab>('diagnosis')
  const [toast, setToast]                 = useState<{text:string;type:'success'|'error'|'info'}|null>(null)

  const showToast = (text: string, type: 'success'|'error'|'info' = 'info') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  const api = useCallback(async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}`, ...(opts.headers || {}) },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [sessionToken])

  const logEvent = useCallback(async (eventType: string, title: string, detail?: string, oldValue?: string, newValue?: string) => {
    if (!sessionToken || !id) return
    try {
      await api('/api/job-events', {
        method: 'POST',
        body: JSON.stringify({ jobId: id, eventType, title, detail, oldValue, newValue }),
      })
    } catch { /* non-fatal */ }
  }, [api, id, sessionToken])

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      setSessionToken(session.access_token)

      const { data: profile } = await supabase.from('profiles').select('role, first_name, last_name').eq('id', session.user.id).single()
      setUserRole(profile?.role || 'technician')
      setUserId(session.user.id)
      setUserName(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim())

      const [{ data: jobData }, { data: inspData }, { data: profileData }, { data: settingsData }] = await Promise.all([
        supabase.from('jobs').select('*, vehicles (*, customers (*))').eq('id', id).single(),
        supabase.from('inspections').select('checklist, recommendations').eq('job_id', id).single(),
        supabase.from('profiles').select('id, first_name, last_name').order('first_name'),
        supabase.from('shop_settings').select('*').eq('id', 1).single(),
      ])

      if (!jobData) throw new Error('Job not found')

      setJob(jobData)
      setNotes(jobData.tech_diagnosis || '')
      setStatus(jobData.status)
      setOdometer(jobData.odometer ? String(jobData.odometer) : '')
      setIsArchived(jobData.is_archived || false)
      setPaymentStatus(jobData.payment_status || 'unpaid')
      setPaymentMethod(jobData.payment_method || '')
      setPaymentNotes(jobData.payment_notes || '')
      setAmountPaid(jobData.amount_paid ? String(jobData.amount_paid) : '')
      if (profileData) setTechs(profileData)
      if (settingsData) setShopSettings(settingsData)

      document.title = `Ticket #${jobData.id.slice(0,8)} | Heavy Haul Auto`

      const type = jobData.vehicles.vehicle_type || 'car'
      const allItems = [...(GENERAL_CHECKLISTS[type]||GENERAL_CHECKLISTS.car), ...(TIRE_CONFIGS[type]||TIRE_CONFIGS.car)]
      const savedChecklist = inspData?.checklist || {}
      const savedRecs = inspData?.recommendations || {}
      if (savedRecs.service_lines) setServiceJobs(savedRecs.service_lines)
      else setServiceJobs([{ id: generateId(), title: 'Diagnosis / Primary Repair', labor: [], parts: [] }])
      const fc: any = {}; const fr: any = { ...savedRecs }
      allItems.forEach(item => {
        fc[item] = savedChecklist[item] || { status: 'pending', note: '' }
        fr[item] = savedRecs[item] || { service: '', parts: 0, labor: 0, decision: 'pending', noCost: false }
      })
      setInspection(fc); setRecommendations(fr)

      loadTimeEntries(id as string, session.access_token)
      loadPurchaseOrders(id as string, session.access_token)
      loadEvents(id as string, session.access_token)

      setSaving_(false)
    } catch (err) {
      console.error(err); router.push('/dashboard')
    }
  }, [id, router])

  useEffect(() => { fetchData() }, [fetchData])

  const loadTimeEntries = async (jobId: string, _token: string) => {
    const { data } = await supabase.from('job_time_entries').select('*').eq('job_id', jobId).order('clocked_in', { ascending: false })
    if (data) { setTimeEntries(data); setClockedInEntry(data.find((e: any) => !e.clocked_out) || null) }
  }
  const loadPurchaseOrders = async (jobId: string, _token: string) => {
    const { data } = await supabase.from('purchase_orders').select('*').eq('job_id', jobId).order('created_at', { ascending: false })
    if (data) setPurchaseOrders(data)
  }
  const loadEvents = async (jobId: string, _token: string) => {
    const { data } = await supabase.from('job_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false })
    if (data) setEvents(data)
  }

  // ── Core save ─────────────────────────────────────────────────────────────
  const prevStatus = job?.status
  const performSave = async () => {
    const { error } = await supabase.from('jobs').update({
      tech_diagnosis: notes, status, odometer: odometer ? parseInt(odometer) : null
    }).eq('id', id)
    if (error) throw new Error(error.message)

    await supabase.from('inspections').upsert(
      { job_id: id, checklist: inspection, recommendations: { ...recommendations, service_lines: serviceJobs }, updated_at: new Date() },
      { onConflict: 'job_id' }
    )

    if (status !== prevStatus) {
      await logEvent('status_change', `Status changed to "${status.replace('_',' ')}"`, undefined, prevStatus, status)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try { await performSave(); showToast('Saved!', 'success') }
    catch (err: any) { showToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const handleAssignTech = async (val: string) => {
    const techId = val === '' ? null : val
    const techName = techs.find(t => t.id === val)
    setJob({ ...job, assigned_tech_id: techId })
    await supabase.from('jobs').update({ assigned_tech_id: techId }).eq('id', id)
    await logEvent('assignment', techId ? `Assigned to ${techName?.first_name} ${techName?.last_name}` : 'Unassigned technician')
  }

  const handleArchive = async () => {
    const newValue = !isArchived
    if (newValue && !confirm('Save all current work and archive this job?')) return
    setSaving(true)
    try {
      await performSave()
      await supabase.from('jobs').update({ is_archived: newValue }).eq('id', id)
      setIsArchived(newValue)
      await logEvent('archive', newValue ? 'Job archived' : 'Job restored from archive')
      if (newValue) router.push('/dashboard')
    } catch (err: any) { showToast('Error archiving: ' + err.message, 'error') }
    finally { setSaving(false) }
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  const handleSavePayment = async () => {
    setSavingPayment(true)
    try {
      const old = job.payment_status
      await supabase.from('jobs').update({
        payment_status: paymentStatus, payment_method: paymentMethod || null,
        payment_notes: paymentNotes || null,
        payment_date: paymentStatus !== 'unpaid' ? new Date().toISOString() : null,
        amount_paid: amountPaid ? parseFloat(amountPaid) : 0,
      }).eq('id', id)
      await logEvent('payment', `Payment updated to "${paymentStatus}"`, `Method: ${paymentMethod || 'N/A'} • Amount paid: ${fmt(amountPaid)}`, old, paymentStatus)
      setJob({ ...job, payment_status: paymentStatus })
      showToast('Payment updated!', 'success')
    } catch (err: any) { showToast(err.message, 'error') }
    finally { setSavingPayment(false) }
  }

  // ── Time tracking ─────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setClockLoading(true)
    try {
      const { data, error } = await supabase.from('job_time_entries').insert({
        job_id: id, tech_id: userId, tech_name: userName, clocked_in: new Date().toISOString(), notes: timeNotes || null
      }).select().single()
      if (error) throw error
      setClockedInEntry(data); setTimeEntries(prev => [data, ...prev]); setTimeNotes('')
      await logEvent('tech_clock', `${userName} clocked IN`)
      showToast('Clocked in!', 'success')
    } catch (err: any) { showToast(err.message, 'error') }
    finally { setClockLoading(false) }
  }

  const handleClockOut = async () => {
    if (!clockedInEntry) return
    setClockLoading(true)
    try {
      const clockOut = new Date().toISOString()
      const { error } = await supabase.from('job_time_entries').update({ clocked_out: clockOut, notes: timeNotes || clockedInEntry.notes }).eq('id', clockedInEntry.id)
      if (error) throw error
      const mins = Math.round((new Date(clockOut).getTime() - new Date(clockedInEntry.clocked_in).getTime()) / 60000)
      setClockedInEntry(null)
      setTimeEntries(prev => prev.map(e => e.id === clockedInEntry.id ? { ...e, clocked_out: clockOut, duration_minutes: mins } : e))
      setTimeNotes('')
      await logEvent('tech_clock', `${userName} clocked OUT — ${fmtMins(mins)}`)
      showToast(`Clocked out — ${fmtMins(mins)}`, 'success')
    } catch (err: any) { showToast(err.message, 'error') }
    finally { setClockLoading(false) }
  }

  const totalTrackedMins = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0)

  // ── Purchase orders ───────────────────────────────────────────────────────
  const addPOItem = () => setPoForm(prev => ({ ...prev, items: [...prev.items, { id: generateId(), partNumber: '', name: '', qty: 1, unitCost: 0 }] }))
  const removePOItem = (itemId: string) => setPoForm(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }))
  const updatePOItem = (itemId: string, field: string, val: any) =>
    setPoForm(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, [field]: val } : i) }))
  const poTotal = poForm.items.reduce((s, i) => s + (Number(i.qty)||0) * (Number(i.unitCost)||0), 0)

  const handleCreatePO = async () => {
    if (!poForm.vendor.trim()) { showToast('Vendor is required', 'error'); return }
    setSavingPO(true)
    try {
      const poNum = `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000+Math.random()*9000)}`
      const { data, error } = await supabase.from('purchase_orders').insert({
        job_id: id, po_number: poNum, vendor: poForm.vendor,
        expected_date: poForm.expectedDate || null, notes: poForm.notes || null,
        ordered_by_id: userId, ordered_by_name: userName,
        line_items: poForm.items.map(({ id: _, ...rest }) => rest),
      }).select().single()
      if (error) throw error
      setPurchaseOrders(prev => [data, ...prev])
      await logEvent('po_created', `PO ${poNum} created — ${poForm.vendor}`, `${poForm.items.length} item(s) • ${fmt(poTotal)}`)
      setShowPOForm(false)
      setPoForm({ vendor: '', expectedDate: '', notes: '', items: [{ id: generateId(), partNumber: '', name: '', qty: 1, unitCost: 0 }] })
      showToast(`PO ${poNum} created!`, 'success')
    } catch (err: any) { showToast(err.message, 'error') }
    finally { setSavingPO(false) }
  }

  const handleUpdatePOStatus = async (poId: string, newStatus: string) => {
    const updates: any = { status: newStatus }
    if (newStatus === 'received') updates.received_date = new Date().toISOString().slice(0,10)
    await supabase.from('purchase_orders').update(updates).eq('id', poId)
    setPurchaseOrders(prev => prev.map(p => p.id === poId ? { ...p, ...updates } : p))
    const po = purchaseOrders.find(p => p.id === poId)
    await logEvent('po_updated', `PO ${po?.po_number} marked "${newStatus}"`)
    showToast('PO updated', 'success')
  }

  // ── Inspection helpers ────────────────────────────────────────────────────
  const toggleItem = (item: string, s: string) => setInspection({ ...inspection, [item]: { ...inspection[item], status: s } })
  const updateNote = (item: string, text: string) => setInspection({ ...inspection, [item]: { ...inspection[item], note: text } })
  const updateRec  = (item: string, field: string, value: any) => {
    let nd = { ...recommendations[item], [field]: value }
    if (field === 'noCost' && value === true) { nd.parts = 0; nd.labor = 0 }
    if (field === 'decision' && value === 'approved') {
      const existing = serviceJobs.find(j => j.title === (nd.service || item))
      if (!existing) {
        const nj: any = { id: generateId(), title: nd.service || `Repair: ${item}`, labor: [], parts: [] }
        if (nd.labor > 0) nj.labor.push({ id: generateId(), desc: 'Labor', hours: 1, rate: nd.labor })
        if (nd.parts > 0) nj.parts.push({ id: generateId(), partNumber: '', name: 'Parts', qty: 1, price: nd.parts })
        setServiceJobs(prev => [...prev, nj])
        showToast(`"${item}" linked to new Job Line`, 'success')
      }
    }
    setRecommendations({ ...recommendations, [item]: nd })
  }

  // ── Service job CRUD ──────────────────────────────────────────────────────
  const addServiceJob   = (title='') => {
    setServiceJobs(prev => [...prev, { id: generateId(), title: title||'New Job Line', labor: [], parts: [] }])
    logEvent('job_line', `Job line added: "${title||'New Job Line'}"`)
  }
  const removeServiceJob = (jid: string) => {
    const j = serviceJobs.find(x => x.id === jid)
    if (!confirm('Delete this job line?')) return
    setServiceJobs(serviceJobs.filter(x => x.id !== jid))
    logEvent('job_line', `Job line deleted: "${j?.title||'Unknown'}"`)
  }
  const updateJobTitle  = (jid: string, v: string) => setServiceJobs(serviceJobs.map(j => j.id===jid ? {...j,title:v} : j))
  const blurJobTitle    = (jid: string, v: string) => { const prev = serviceJobs.find(j=>j.id===jid); if(prev?.title!==v) logEvent('job_line', `Job title renamed: "${v}"`, undefined, prev?.title, v) }
  const addLabor   = (jid: string) => {
    setServiceJobs(serviceJobs.map(j => j.id!==jid ? j : { ...j, labor: [...j.labor, { id: generateId(), desc: '', hours: 0, rate: shopSettings.labor_rate }] }))
    logEvent('job_line', `Labor line added to: "${serviceJobs.find(j=>j.id===jid)?.title||''}"`)
  }
  const updateLabor = (jid: string, lid: string, f: string, v: any) => setServiceJobs(serviceJobs.map(j => j.id!==jid ? j : { ...j, labor: j.labor.map((l: any) => l.id===lid ? {...l,[f]:v} : l) }))
  const removeLabor = (jid: string, lid: string) => {
    const j = serviceJobs.find(x=>x.id===jid); const l = j?.labor?.find((x:any)=>x.id===lid)
    setServiceJobs(serviceJobs.map(x => x.id!==jid ? x : { ...x, labor: x.labor.filter((y: any) => y.id!==lid) }))
    logEvent('job_line', `Labor removed: "${l?.desc||'labor line'}" from "${j?.title||''}"`)
  }
  const addPart   = (jid: string) => {
    setServiceJobs(serviceJobs.map(j => j.id!==jid ? j : { ...j, parts: [...j.parts, { id: generateId(), partNumber: '', name: '', qty: 1, price: 0 }] }))
    logEvent('job_line', `Part added to: "${serviceJobs.find(j=>j.id===jid)?.title||''}"`)
  }
  const updatePart = (jid: string, pid: string, f: string, v: any) => setServiceJobs(serviceJobs.map(j => j.id!==jid ? j : { ...j, parts: j.parts.map((p: any) => p.id===pid ? {...p,[f]:v} : p) }))
  const removePart = (jid: string, pid: string) => {
    const j = serviceJobs.find(x=>x.id===jid); const p = j?.parts?.find((x:any)=>x.id===pid)
    setServiceJobs(serviceJobs.map(x => x.id!==jid ? x : { ...x, parts: x.parts.filter((y: any) => y.id!==pid) }))
    logEvent('job_line', `Part removed: "${p?.name||'part'}" from "${j?.title||''}"`)
  }

  // ── FIX: Use getSellPrice so job page totals match invoices ───────────────
  const getJobTotals = (j: any) => {
    const lt = j.labor.reduce((a: number, l: any) => a + parseFloat(l.hours||0)*parseFloat(l.rate||0), 0)
    const pt = j.parts.reduce((a: number, p: any) => {
      const sell = getSellPrice(Number(p.price)||0, customerType as 'retail'|'commercial', shopSettings as ShopSettings)
      return a + parseFloat(p.qty||0) * sell
    }, 0)
    return { laborTotal: lt, partsTotal: pt, total: lt+pt }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const canAssign     = userRole === 'admin' || userRole === 'advisor'
  const canViewInvoice = userRole === 'admin' || userRole === 'advisor'
  const type          = job?.vehicles?.vehicle_type || 'car'
  const customerType  = job?.vehicles?.customers?.customer_type || 'retail'

  const copyPublicLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/public/inspection/${id}`)
    showToast('Public link copied!', 'info')
  }

  const getApprovedItems = () => Object.keys(recommendations).filter(k => recommendations[k].decision === 'approved')

  const renderRecommendationBox = (item: string) => {
    if (inspection[item]?.status !== 'fail') return null
    const rec = recommendations[item] || {}
    const isEditable = canAssign
    let bc = 'border-indigo-500/30', bg = 'bg-slate-900'
    if (rec.decision==='approved') { bc='border-green-500'; bg='bg-green-900/10' }
    if (rec.decision==='denied')   { bc='border-red-500/50'; bg='bg-red-900/10' }
    return (
      <div className={`mt-3 ${bg} border ${bc} rounded p-3 ml-4 relative transition-colors`}>
        <div className={`absolute -left-2 top-3 w-2 h-2 border-l border-b ${bc} bg-slate-950 rotate-45`} />
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">🛠️ Recommendation & Estimate</h4>
          <div className="flex items-center gap-2">
            {rec.decision==='approved' && <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-1 rounded">APPROVED</span>}
            {rec.decision==='denied'   && <span className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-1 rounded">DENIED</span>}
            {rec.decision==='pending'  && <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">PENDING</span>}
            {isEditable && (
              <div className="flex gap-1 ml-2 border-l border-slate-700 pl-2 items-center">
                <button onClick={() => updateRec(item,'decision','approved')} className="text-xs opacity-50 hover:opacity-100 hover:text-green-400">✅</button>
                <button onClick={() => updateRec(item,'decision','denied')}   className="text-xs opacity-50 hover:opacity-100 hover:text-red-400">❌</button>
                <button onClick={() => updateRec(item,'decision','pending')}  className="text-xs opacity-50 hover:opacity-100 hover:text-blue-400 font-bold px-1 ml-1">↺</button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-6"><input type="text" placeholder="Recommended Service..." value={rec.service||''} onChange={e=>updateRec(item,'service',e.target.value)} disabled={!isEditable} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-indigo-500" /></div>
          <div className="md:col-span-2 flex items-center justify-center bg-slate-950 border border-slate-700 rounded p-2">
            <label className="text-xs font-bold text-slate-400 flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={rec.noCost||false} onChange={e=>updateRec(item,'noCost',e.target.checked)} disabled={!isEditable} className="accent-green-500" /> NO CHARGE
            </label>
          </div>
          <div className="md:col-span-2 relative">
            <span className={`absolute left-2 top-2 text-xs ${rec.noCost?'text-slate-700':'text-slate-500'}`}>$</span>
            <input type="number" placeholder="Parts" value={rec.parts||''} onChange={e=>updateRec(item,'parts',parseFloat(e.target.value)||0)} disabled={!isEditable||rec.noCost} className={`w-full bg-slate-950 border border-slate-700 rounded p-2 pl-4 text-sm text-white outline-none focus:border-indigo-500 ${rec.noCost&&'opacity-30 cursor-not-allowed'}`} />
          </div>
          <div className="md:col-span-2 relative">
            <span className={`absolute left-2 top-2 text-xs ${rec.noCost?'text-slate-700':'text-slate-500'}`}>$</span>
            <input type="number" placeholder="Labor" value={rec.labor||''} onChange={e=>updateRec(item,'labor',parseFloat(e.target.value)||0)} disabled={!isEditable||rec.noCost} className={`w-full bg-slate-950 border border-slate-700 rounded p-2 pl-4 text-sm text-white outline-none focus:border-indigo-500 ${rec.noCost&&'opacity-30 cursor-not-allowed'}`} />
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-10 text-white bg-slate-950 min-h-screen">Loading Ticket...</div>

  const TABS: { key: Tab; label: string; icon: string; guard?: boolean }[] = [
    { key: 'diagnosis',   label: 'Diagnosis & Jobs', icon: '🛠️' },
    { key: 'inspection',  label: 'Inspection',       icon: '🔍' },
    { key: 'payment',     label: 'Payment',          icon: '💳', guard: canAssign },
    { key: 'parts_orders',label: 'Parts / POs',      icon: '📦' },
    { key: 'time',        label: 'Time',             icon: '⏱️' },
    { key: 'history',     label: 'Audit Log',        icon: '📋', guard: canAssign },
  ]

  const poStatusColor: Record<string,string> = { ordered: 'text-amber-400', partial: 'text-blue-400', received: 'text-green-400', cancelled: 'text-slate-500' }
  const payBadge = paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400 border-green-500/40'
                 : paymentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                 : 'bg-red-500/20 text-red-400 border-red-500/40'

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${
          toast.type==='success' ? 'bg-green-500 text-slate-900' :
          toast.type==='error'   ? 'bg-red-500 text-white'       : 'bg-indigo-600 text-white'
        }`}>{toast.text}</div>
      )}

      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-10 flex justify-between items-center shadow-md flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-1 rounded">WORK ORDER</span>
            <span className="text-slate-400 text-sm font-mono">#{job.id.slice(0,8)}</span>
            {isArchived && <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-1 rounded">ARCHIVED</span>}
            <span className={`text-xs font-bold border px-2 py-1 rounded uppercase ${payBadge}`}>{paymentStatus}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 text-sm">Back</Link>
          <button onClick={copyPublicLink} className="px-3 py-2 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 rounded text-sm">🔗 Share</button>
          <Link href={`/jobs/${id}/history`}><button className="px-3 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 text-sm">🕒</button></Link>
          <Link href={`/jobs/${id}/print-inspection`}><button className="px-3 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 text-sm">🖨️ Insp.</button></Link>
          {canViewInvoice && (
            <div className="flex gap-2">
              <Link href={`/jobs/${id}/invoice`}><button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-sm">Invoice $$</button></Link>
              <Link href={`/jobs/${id}/print-invoice`}><button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-sm">🖨️ PDF</button></Link>
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded text-sm">{saving ? 'Saving...' : 'Save Work'}</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Job Status</h3>
              <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded focus:ring-2 focus:ring-amber-500 outline-none">
                <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="in_shop">In Shop</option>
                <option value="waiting_approval">Waiting On Approval</option><option value="waiting_parts">Waiting on Parts</option>
                <option value="ready">Ready for Pickup</option><option value="invoiced">Invoiced / Closed</option>
              </select>
            </div>
            {canAssign && (
              <div className="pt-2 border-t border-slate-800">
                {isArchived
                  ? <button onClick={handleArchive} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-sm">📂 Restore Job</button>
                  : <button onClick={handleArchive} className="w-full py-2 bg-transparent border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 rounded font-bold text-sm">🗄️ Save & Archive</button>
                }
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Assigned Technician</h3>
                {!canAssign && <span className="text-xs text-slate-500">🔒</span>}
              </div>
              <select value={job.assigned_tech_id||''} onChange={e=>handleAssignTech(e.target.value)} disabled={!canAssign} className={`w-full bg-slate-950 border border-slate-700 text-white p-3 rounded outline-none ${canAssign?'focus:ring-2 focus:ring-indigo-500':'opacity-50 cursor-not-allowed'}`}>
                <option value="">-- Unassigned --</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase">Vehicle & Customer</h3>
              {canAssign && <Link href={`/jobs/${id}/edit`} className="text-indigo-400 hover:text-white text-xs font-bold border border-indigo-500/30 px-2 py-1 rounded bg-indigo-500/10">✎ EDIT</Link>}
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Owner:</span> {job.vehicles?.customers?.first_name} {job.vehicles?.customers?.last_name}</p>
              <p><span className="text-slate-500">Phone:</span> {job.vehicles?.customers?.phone}</p>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Type:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${customerType==='commercial' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {customerType.toUpperCase()}
                </span>
                <span className="text-slate-600 text-xs">tiered markup</span>
              </div>
              <div className="h-px bg-slate-800 my-2" />
              <p><span className="text-slate-500">Vehicle:</span> {job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}</p>
              <p><span className="text-slate-500">VIN:</span> <span className="font-mono text-xs">{job.vehicles?.vin}</span></p>
              <p className="text-slate-500">Type: <span className="text-xs font-bold uppercase bg-slate-800 px-2 py-1 rounded ml-1">{job.vehicles?.vehicle_type?.replace('_',' ')||'CAR'}</span></p>
              <div className="h-px bg-slate-800 my-2" />
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">🔢 Odometer</label>
                <div className="relative">
                  <input type="number" placeholder="e.g. 142500" value={odometer} onChange={e=>setOdometer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-10 text-white font-mono focus:border-amber-500 outline-none text-sm" />
                  <span className="absolute right-3 top-2 text-xs text-slate-500">mi</span>
                </div>
              </div>
              {totalTrackedMins > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-500 text-xs">⏱️ Total time: </span>
                  <span className="text-amber-400 text-xs font-bold">{fmtMins(totalTrackedMins)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-0">

          <div className="flex border-b border-slate-800 mb-6 overflow-x-auto">
            {TABS.filter(t => t.guard === undefined || t.guard).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab===t.key ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'
                }`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* ── DIAGNOSIS & JOBS TAB ── */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-6">
              <div className="bg-red-900/10 border border-red-900/30 p-5 rounded-lg">
                <h3 className="text-red-400 text-sm font-bold uppercase mb-2">Customer Complaint</h3>
                <p className="text-slate-200">{job.customer_complaint}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-800 h-40 flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Technician Diagnosis</h3>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="flex-grow bg-slate-950 border border-slate-700 rounded p-4 text-white focus:border-amber-500 outline-none font-mono" placeholder="Technician notes..." />
              </div>

              {/* Markup info banner */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
                <span className="text-slate-500">💡</span>
                <span className="text-slate-400">
                  Parts pricing: <strong className={customerType==='commercial'?'text-blue-400':'text-slate-200'}>{customerType}</strong> tiered matrix
                  — enter your <strong className="text-slate-200">cost</strong>, sell price is calculated automatically per tier.
                </span>
              </div>

              {/* ── STREAMLINED JOB LINES ── */}
              <div className="border-t border-slate-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">🛠️ Repair Orders</h2>
                  <button onClick={() => addServiceJob()} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded">+ New Job Line</button>
                </div>
                <div className="space-y-4">
                  {serviceJobs.map((j, index) => {
                    const totals = getJobTotals(j)
                    return (
                      <div key={j.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        {/* Job header — compact */}
                        <div className="bg-slate-800/60 px-4 py-3 flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-amber-500 font-black text-sm shrink-0">#{index+1}</span>
                            <input type="text" placeholder="Job title..." value={j.title} onChange={e=>updateJobTitle(j.id,e.target.value)} onBlur={e=>blurJobTitle(j.id,e.target.value)}
                              className="flex-1 bg-transparent border-0 border-b border-slate-700 focus:border-indigo-500 text-white font-bold outline-none py-1 text-sm" />
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-indigo-400 font-bold text-lg">{fmt(totals.total)}</span>
                            <button onClick={() => removeServiceJob(j.id)} className="text-red-500/50 hover:text-red-400 text-xs" title="Delete job line">✕</button>
                          </div>
                        </div>

                        {/* Labor rows */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Labor <span className="font-normal text-slate-600">@ {fmt(shopSettings.labor_rate)}/hr</span></span>
                            <button onClick={() => addLabor(j.id)} className="text-xs text-indigo-400 hover:text-white font-bold">+ Add</button>
                          </div>
                          {j.labor.map((l: any) => (
                            <div key={l.id} className="flex items-center gap-2">
                              <input type="text" placeholder="Operation" value={l.desc} onChange={e=>updateLabor(j.id,l.id,'desc',e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-sm" />
                              <div className="relative w-20"><span className="absolute left-2 top-1.5 text-[10px] text-slate-500">hrs</span><input type="number" value={l.hours} onChange={e=>updateLabor(j.id,l.id,'hours',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 pl-7 rounded text-sm" /></div>
                              <div className="relative w-20"><span className="absolute left-2 top-1.5 text-[10px] text-slate-500">$</span><input type="number" value={l.rate} onChange={e=>updateLabor(j.id,l.id,'rate',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 pl-5 rounded text-sm" /></div>
                              <span className="text-slate-400 text-sm font-bold w-20 text-right">{fmt(l.hours*l.rate)}</span>
                              <button onClick={() => removeLabor(j.id,l.id)} className="text-red-400/50 hover:text-red-400 text-xs px-1">✕</button>
                            </div>
                          ))}
                        </div>

                        {/* Parts rows */}
                        <div className="px-4 py-3 border-t border-slate-800/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Parts <span className="font-normal text-slate-600">(tiered markup)</span></span>
                            <button onClick={() => addPart(j.id)} className="text-xs text-indigo-400 hover:text-white font-bold">+ Add</button>
                          </div>
                          {j.parts.length > 0 && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase px-0.5">
                              <span className="w-24">Part #</span>
                              <span className="flex-1">Name</span>
                              <span className="w-12 text-center">Qty</span>
                              <span className="w-20 text-right">Cost</span>
                              <span className="w-20 text-right">Sell</span>
                              <span className="w-5"></span>
                            </div>
                          )}
                          {j.parts.map((p: any) => {
                            const sellPrice = getSellPrice(Number(p.price)||0, customerType as 'retail'|'commercial', shopSettings as ShopSettings)
                            const tierPct = getMarkupPct(Number(p.price)||0, customerType as 'retail'|'commercial', shopSettings as ShopSettings)
                            return (
                              <div key={p.id} className="flex items-center gap-2">
                                <input type="text" placeholder="Part #" value={p.partNumber} onChange={e=>updatePart(j.id,p.id,'partNumber',e.target.value)} className="w-24 bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-sm font-mono" />
                                <input type="text" placeholder="Name" value={p.name} onChange={e=>updatePart(j.id,p.id,'name',e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 text-white px-2 py-1.5 rounded text-sm" />
                                <input type="number" value={p.qty} onChange={e=>updatePart(j.id,p.id,'qty',e.target.value)} className="w-12 bg-slate-950 border border-slate-700 text-white px-1 py-1.5 rounded text-sm text-center" />
                                <div className="relative w-20"><span className="absolute left-1.5 top-1.5 text-[10px] text-slate-500">$</span><input type="number" value={p.price} onChange={e=>updatePart(j.id,p.id,'price',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white px-2 py-1.5 pl-4 rounded text-sm" /></div>
                                <span className="w-20 text-right text-green-400 text-sm font-bold" title={`${tierPct}% markup`}>{fmt(sellPrice)}</span>
                                <button onClick={() => removePart(j.id,p.id)} className="text-red-400/50 hover:text-red-400 text-xs px-1 w-5">✕</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── INSPECTION TAB ── */}
          {activeTab === 'inspection' && (
            <div className="space-y-8">
              {getApprovedItems().length > 0 && (
                <div className="bg-green-900/10 border border-green-500/30 p-6 rounded-lg">
                  <h3 className="text-lg font-bold text-green-400 mb-4">✅ APPROVED WORK</h3>
                  <div className="space-y-3">
                    {getApprovedItems().map(key => (
                      <div key={key} className="flex justify-between items-center bg-slate-950 p-3 rounded border border-green-500/20">
                        <div><span className="font-bold text-white block">{recommendations[key].service}</span><span className="text-xs text-slate-500">{key}</span></div>
                        <span className="text-green-500 font-bold text-sm">APPROVED</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">🔍 General Inspection</h3>
                <div className="space-y-4">
                  {(GENERAL_CHECKLISTS[type]||GENERAL_CHECKLISTS.car).map((item: string) => inspection[item] && (
                    <div key={item} className="p-3 bg-slate-950 rounded border border-slate-800 hover:border-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-200">{item}</span>
                        <div className="flex gap-2">
                          {['pass','fail','na'].map(s => (
                            <button key={s} onClick={() => toggleItem(item,s)} className={`px-3 py-1 rounded text-xs font-bold border ${
                              inspection[item].status===s
                                ? s==='pass' ? 'bg-green-500/20 text-green-400 border-green-500' : s==='fail' ? 'bg-red-500/20 text-red-400 border-red-500' : 'bg-slate-700 text-slate-300 border-slate-600'
                                : 'border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}>{s==='pass'?'GOOD':s==='fail'?'BAD':'N/A'}</button>
                          ))}
                        </div>
                      </div>
                      {inspection[item].status==='fail' && (
                        <div className="space-y-2">
                          <input type="text" placeholder="Reason for failure..." value={inspection[item].note||''} onChange={e=>updateNote(item,e.target.value)} className="mt-3 w-full bg-red-900/10 border border-red-900/30 rounded p-2 text-sm text-red-200 outline-none focus:border-red-500" />
                          {renderRecommendationBox(item)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">🛞 Tire Station</h3>
                <p className="text-xs text-slate-500 mb-6">Record Tread Depth & PSI for all tires.</p>
                <div className="space-y-2">
                  {(TIRE_CONFIGS[type]||TIRE_CONFIGS.car).map((item: string) => inspection[item] && (
                    <div key={item} className="p-3 border border-slate-800 rounded bg-slate-950 mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-sm text-slate-300 font-bold">{item}</span>
                        <div className="flex gap-2">
                          {['pass','fail','na'].map(s => (
                            <button key={s} onClick={() => toggleItem(item,s)} className={`py-1 rounded text-xs font-bold border ${s==='na'?'w-10':'w-12'} ${
                              inspection[item].status===s
                                ? s==='pass' ? 'bg-green-500/20 text-green-400 border-green-500' : s==='fail' ? 'bg-red-500/20 text-red-400 border-red-500' : 'bg-slate-700 text-slate-300 border-slate-600'
                                : 'border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}>{s==='pass'?'OK':s==='fail'?'BAD':'N/A'}</button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-500">DATA:</span>
                        <input type="text" placeholder="e.g. 10/32 100psi" value={inspection[item].note||''} onChange={e=>updateNote(item,e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-12 text-sm text-white focus:border-indigo-500 outline-none" />
                      </div>
                      {inspection[item].status==='fail' && renderRecommendationBox(item)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT TAB ── */}
          {activeTab === 'payment' && canAssign && (
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">💳 Payment Status</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { value:'unpaid',  label:'Unpaid',  color:'border-red-500 bg-red-500/10 text-red-400' },
                    { value:'partial', label:'Partial', color:'border-amber-500 bg-amber-500/10 text-amber-400' },
                    { value:'paid',    label:'Paid',    color:'border-green-500 bg-green-500/10 text-green-400' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setPaymentStatus(opt.value)}
                      className={`py-4 rounded-lg border-2 font-black text-lg transition-all ${paymentStatus===opt.value ? opt.color : 'border-slate-700 bg-slate-950 text-slate-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Payment Method</label>
                    <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded outline-none">
                      <option value="">-- Select --</option><option value="cash">Cash</option><option value="card">Credit / Debit Card</option><option value="check">Check</option><option value="financing">Financing</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Amount Paid</label>
                    <div className="relative"><span className="absolute left-3 top-3.5 text-slate-500">$</span>
                    <input type="number" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-700 text-white p-3 pl-7 rounded outline-none" /></div>
                  </div>
                </div>
                <div className="mb-6">
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Payment Notes</label>
                  <textarea value={paymentNotes} onChange={e=>setPaymentNotes(e.target.value)} rows={2} placeholder="Check #, authorization code, etc." className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" />
                </div>
                {job.payment_date && <p className="text-xs text-slate-500 mb-4">Last payment: {new Date(job.payment_date).toLocaleString()}</p>}
                <button onClick={handleSavePayment} disabled={savingPayment} className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-lg">
                  {savingPayment ? 'Saving...' : '💳 Save Payment Record'}
                </button>
              </div>
            </div>
          )}

          {/* ── PARTS / POs TAB ── */}
          {activeTab === 'parts_orders' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">📦 Purchase Orders</h3>
                <button onClick={() => setShowPOForm(!showPOForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded">{showPOForm ? '✕ Cancel' : '+ Create PO'}</button>
              </div>

              {showPOForm && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
                  <h4 className="font-bold text-white">New Purchase Order</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Vendor *</label><input type="text" value={poForm.vendor} onChange={e=>setPoForm({...poForm,vendor:e.target.value})} placeholder="e.g. NAPA" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Expected Arrival</label><input type="date" value={poForm.expectedDate} onChange={e=>setPoForm({...poForm,expectedDate:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" /></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-400 uppercase">Parts to Order</label><button onClick={addPOItem} className="text-xs text-indigo-400 hover:text-white border border-indigo-500/30 px-2 py-1 rounded">+ Add</button></div>
                    {poForm.items.map(item => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                        <div className="col-span-2"><input type="text" placeholder="Part #" value={item.partNumber} onChange={e=>updatePOItem(item.id,'partNumber',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm font-mono" /></div>
                        <div className="col-span-4"><input type="text" placeholder="Name" value={item.name} onChange={e=>updatePOItem(item.id,'name',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm" /></div>
                        <div className="col-span-2"><input type="number" value={item.qty} onChange={e=>updatePOItem(item.id,'qty',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm text-center" /></div>
                        <div className="col-span-3 relative"><span className="absolute left-2 top-2 text-xs text-slate-500">$</span><input type="number" value={item.unitCost} onChange={e=>updatePOItem(item.id,'unitCost',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 pl-5 rounded text-sm" /></div>
                        <div className="col-span-1 flex justify-end"><button onClick={() => removePOItem(item.id)} className="text-red-400 font-bold px-2">×</button></div>
                      </div>
                    ))}
                    <div className="flex justify-end mt-2"><span className="text-sm font-bold text-slate-400">PO Total: <span className="text-white">{fmt(poTotal)}</span></span></div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Notes</label><textarea value={poForm.notes} onChange={e=>setPoForm({...poForm,notes:e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" /></div>
                  <button onClick={handleCreatePO} disabled={savingPO} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg">{savingPO ? 'Creating...' : '📦 Create Purchase Order'}</button>
                </div>
              )}

              {purchaseOrders.length === 0 && !showPOForm && <div className="text-center py-12 text-slate-500"><div className="text-4xl mb-3">📦</div><p>No purchase orders.</p></div>}

              {purchaseOrders.map(po => (
                <div key={po.id} className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800 px-5 py-4 flex justify-between items-center">
                    <div><span className="font-mono font-black text-white text-sm">{po.po_number}</span><span className="ml-3 text-slate-300">{po.vendor}</span></div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase ${poStatusColor[po.status]}`}>{po.status}</span>
                      <select value={po.status} onChange={e=>handleUpdatePOStatus(po.id,e.target.value)} className="bg-slate-950 border border-slate-700 text-white text-xs px-2 py-1 rounded outline-none">
                        <option value="ordered">Ordered</option><option value="partial">Partial</option><option value="received">Received</option><option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-6 text-xs text-slate-400 mb-4 flex-wrap">
                      <span>By: <strong className="text-slate-200">{po.ordered_by_name}</strong></span>
                      <span>Date: <strong className="text-slate-200">{new Date(po.created_at).toLocaleDateString()}</strong></span>
                      {po.expected_date && <span>Expected: <strong className="text-amber-400">{po.expected_date}</strong></span>}
                      {po.received_date && <span>Received: <strong className="text-green-400">{po.received_date}</strong></span>}
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="text-slate-500 text-xs uppercase border-b border-slate-800"><th className="pb-2 text-left">Part #</th><th className="pb-2 text-left">Name</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit</th><th className="pb-2 text-right">Total</th></tr></thead>
                      <tbody>{(po.line_items||[]).map((li: any, i: number) => (
                        <tr key={i} className="border-b border-slate-800/50"><td className="py-2 font-mono text-xs text-slate-400">{li.partNumber||'—'}</td><td className="py-2 text-slate-200">{li.name}</td><td className="py-2 text-center">{li.qty}</td><td className="py-2 text-right text-slate-400">{fmt(li.unitCost)}</td><td className="py-2 text-right font-bold">{fmt(li.qty*li.unitCost)}</td></tr>
                      ))}</tbody>
                    </table>
                    <div className="flex justify-end mt-3 pt-3 border-t border-slate-800"><span className="font-bold text-white">Total: {fmt(po.total_cost)}</span></div>
                    {po.notes && <p className="text-xs text-slate-500 mt-3 italic">{po.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TIME TRACKING TAB ── */}
          {activeTab === 'time' && (
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">⏱️ Time Tracking</span>
                  {clockedInEntry && <span className="text-green-400 text-sm font-bold bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-full animate-pulse">● CLOCKED IN</span>}
                </h3>
                <div className="mb-4"><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Notes (optional)</label><input type="text" value={timeNotes} onChange={e=>setTimeNotes(e.target.value)} placeholder="What are you working on?" className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" /></div>
                {clockedInEntry ? (
                  <button onClick={handleClockOut} disabled={clockLoading} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg rounded-lg">{clockLoading ? 'Saving...' : '⏹ Clock Out'}</button>
                ) : (
                  <button onClick={handleClockIn} disabled={clockLoading} className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black text-lg rounded-lg">{clockLoading ? 'Starting...' : '▶ Clock In'}</button>
                )}
              </div>
              {totalTrackedMins > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-5 py-4 flex justify-between items-center">
                  <span className="text-slate-400 font-bold">Total Time Logged</span>
                  <span className="text-2xl font-black text-amber-400">{fmtMins(totalTrackedMins)}</span>
                </div>
              )}
              <div className="space-y-3">
                {timeEntries.length === 0 && <p className="text-center text-slate-500 py-8">No time entries yet.</p>}
                {timeEntries.map(entry => (
                  <div key={entry.id} className="bg-slate-900 rounded-lg border border-slate-800 px-5 py-4">
                    <div className="flex justify-between items-start">
                      <div><span className="font-bold text-white">{entry.tech_name}</span>{entry.notes && <p className="text-xs text-slate-500 mt-0.5">{entry.notes}</p>}</div>
                      <div className="text-right">{entry.clocked_out ? <span className="text-green-400 font-bold text-sm">{fmtMins(entry.duration_minutes||0)}</span> : <span className="text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/30 px-2 py-1 rounded animate-pulse">Active</span>}</div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500"><span>In: {new Date(entry.clocked_in).toLocaleString()}</span>{entry.clocked_out && <span>Out: {new Date(entry.clocked_out).toLocaleString()}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT LOG TAB ── */}
          {activeTab === 'history' && canAssign && (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">📋 Audit Log</h3>
              {events.length === 0 && <p className="text-center text-slate-500 py-12">No events recorded yet.</p>}
              {events.map(ev => {
                const iconMap: Record<string,string> = { status_change:'🔄', payment:'💳', assignment:'👤', archive:'🗄️', po_created:'📦', po_updated:'📦', tech_clock:'⏱️', note:'📝', job_line:'🛠️' }
                return (
                  <div key={ev.id} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 mt-0.5">{iconMap[ev.event_type] || '•'}</div>
                    <div className="flex-1 pb-4 border-b border-slate-800/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-white text-sm">{ev.title}</span>
                          {ev.detail && <p className="text-xs text-slate-400 mt-0.5">{ev.detail}</p>}
                          {ev.old_value && ev.new_value && <p className="text-xs text-slate-600 mt-0.5"><span className="text-red-400">{ev.old_value}</span> → <span className="text-green-400">{ev.new_value}</span></p>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xs text-slate-600">{new Date(ev.created_at).toLocaleString()}</p>
                          {ev.user_name && <p className="text-xs text-indigo-400">{ev.user_name}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}