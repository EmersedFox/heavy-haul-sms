'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const parseMatrix = (m: any) =>
  Array.isArray(m)
    ? m.map((t: any) => ({ upTo: t.upTo === null ? '' : String(t.upTo), markupPct: String(t.markupPct) }))
    : [{ upTo: '', markupPct: '30' }]

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingId, setEditingId] = useState('')
  const [formData, setFormData] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'technician' })
  const [formLoading, setFormLoading] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    labor_rate: '120', tax_rate: '7',
    parts_markup_retail: '30', parts_markup_commercial: '20',
    markup_matrix_retail:     [{ upTo: '25', markupPct: '100' },{ upTo: '100', markupPct: '65' },{ upTo: '300', markupPct: '45' },{ upTo: '', markupPct: '30' }],
    markup_matrix_commercial: [{ upTo: '25', markupPct: '80'  },{ upTo: '100', markupPct: '50' },{ upTo: '300', markupPct: '35' },{ upTo: '', markupPct: '20' }],
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // ── Loads settings into form (reused in two places) ───────────────────────
  const hydrateSettings = (settings: any) => {
    setSettingsForm({
      labor_rate: String(settings.labor_rate),
      parts_markup_retail: String(settings.parts_markup_retail),
      parts_markup_commercial: String(settings.parts_markup_commercial),
      tax_rate: String(settings.tax_rate),
      markup_matrix_retail: parseMatrix(settings.markup_matrix_retail),
      markup_matrix_commercial: parseMatrix(settings.markup_matrix_commercial),
    })
  }

  useEffect(() => {
    const checkAccessAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }

      fetchTeam()

      const { data: settings } = await supabase.from('shop_settings').select('*').eq('id', 1).single()
      if (settings) hydrateSettings(settings)
    }
    checkAccessAndFetch()
  }, [router])

  const fetchTeam = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (data) setEmployees(data)
    setLoading(false)
  }

  const openAddModal = () => { setModalMode('add'); setFormData({ email:'',password:'',firstName:'',lastName:'',role:'technician' }); setIsModalOpen(true) }
  const openEditModal = (emp: any) => { setModalMode('edit'); setEditingId(emp.id); setFormData({ email:emp.email||'',password:'',firstName:emp.first_name||'',lastName:emp.last_name||'',role:emp.role||'technician' }); setIsModalOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormLoading(true)
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formData) })
        const data = await res.json(); if (!res.ok) throw new Error(data.error)
      } else {
        const { error } = await supabase.from('profiles').update({ first_name:formData.firstName, last_name:formData.lastName, role:formData.role }).eq('id', editingId)
        if (error) throw error
      }
      setIsModalOpen(false); fetchTeam()
    } catch (error: any) { alert('Error: ' + error.message) }
    finally { setFormLoading(false) }
  }

  // ── Matrix helpers ────────────────────────────────────────────────────────
  const updateMatrix = (type: 'retail'|'commercial', idx: number, field: 'upTo'|'markupPct', val: string) => {
    const key = type==='retail' ? 'markup_matrix_retail' : 'markup_matrix_commercial'
    setSettingsForm(prev => ({ ...prev, [key]: prev[key].map((t,i) => i===idx?{...t,[field]:val}:t) }))
  }
  const addTier = (type: 'retail'|'commercial') => {
    const key = type==='retail' ? 'markup_matrix_retail' : 'markup_matrix_commercial'
    setSettingsForm(prev => ({ ...prev, [key]: [...prev[key], { upTo:'', markupPct:'30' }] }))
  }
  const removeTier = (type: 'retail'|'commercial', idx: number) => {
    const key = type==='retail' ? 'markup_matrix_retail' : 'markup_matrix_commercial'
    setSettingsForm(prev => ({ ...prev, [key]: prev[key].filter((_,i)=>i!==idx) }))
  }
  const serializeMatrix = (rows: any[]) => rows.map(r => ({ upTo: r.upTo===''?null:parseFloat(r.upTo), markupPct: parseFloat(r.markupPct)||0 }))

  const handleSaveSettings = async () => {
    setSavingSettings(true); setSettingsError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/shop-settings', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session!.access_token}` },
        body: JSON.stringify({
          labor_rate: parseFloat(settingsForm.labor_rate),
          parts_markup_retail: parseFloat(settingsForm.parts_markup_retail),
          parts_markup_commercial: parseFloat(settingsForm.parts_markup_commercial),
          tax_rate: parseFloat(settingsForm.tax_rate),
          markup_matrix_retail: serializeMatrix(settingsForm.markup_matrix_retail),
          markup_matrix_commercial: serializeMatrix(settingsForm.markup_matrix_commercial),
        }),
      })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      setSettingsSaved(true)
    } catch (err: any) { setSettingsError(err.message) }
    finally { setSavingSettings(false) }
  }

  const handleDeleteUser = async (userId: string) => {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method:'DELETE' })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      setDeleteConfirmId(null); fetchTeam()
    } catch (error: any) { alert('Error deleting user: ' + error.message) }
    finally { setDeleteLoading(false) }
  }

  if (loading) return <div className="p-10 bg-slate-950 text-white">Loading Admin...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-amber-500">Admin Console</h1>
            <p className="text-slate-400">Team Management</p>
          </div>
          <div className="flex gap-4">
            <button onClick={openAddModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold rounded shadow-lg transition-colors">+ Add User</button>
            <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold rounded transition-colors text-slate-300">⚙️ Shop Settings</button>
            <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:text-white">Exit</Link>
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead><tr className="text-slate-500 text-sm uppercase bg-slate-900/50"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-800/50">
                  <td className="p-4 font-bold">{emp.first_name} {emp.last_name}{emp.id===currentUserId&&<span className="ml-2 text-xs text-green-500 bg-green-500/10 px-1 rounded">(YOU)</span>}</td>
                  <td className="p-4 text-slate-400 font-mono text-sm">{emp.email}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${emp.role==='admin'?'bg-amber-500/20 text-amber-500':'bg-slate-700 text-slate-300'}`}>{emp.role}</span></td>
                  <td className="p-4 text-right">
                    {emp.id !== currentUserId && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(emp)} className="text-sm text-indigo-400 hover:text-white font-bold border border-indigo-500/30 px-3 py-1 rounded hover:bg-indigo-600 transition-colors">Edit</button>
                        {deleteConfirmId === emp.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-400 font-bold">Sure?</span>
                            <button onClick={() => handleDeleteUser(emp.id)} disabled={deleteLoading} className="text-sm text-white font-bold border border-red-500 bg-red-600 hover:bg-red-500 px-3 py-1 rounded transition-colors disabled:opacity-50">{deleteLoading ? '...' : 'Yes, Delete'}</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-slate-400 hover:text-white font-bold border border-slate-700 px-3 py-1 rounded transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(emp.id)} className="text-sm text-red-400 hover:text-white font-bold border border-red-500/30 px-3 py-1 rounded hover:bg-red-600 transition-colors">Delete</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SHOP SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">⚙️ Shop Settings</h2>
            <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Labor Rate ($/hr)</label>
                  <div className="relative"><span className="absolute left-3 top-3 text-slate-500 text-sm">$</span>
                  <input type="number" value={settingsForm.labor_rate} onChange={e=>setSettingsForm({...settingsForm,labor_rate:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 pl-7 text-white outline-none focus:border-amber-500" /></div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tax Rate (%)</label>
                  <div className="relative"><span className="absolute right-3 top-3 text-slate-500 text-sm">%</span>
                  <input type="number" value={settingsForm.tax_rate} onChange={e=>setSettingsForm({...settingsForm,tax_rate:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 pr-7 text-white outline-none focus:border-amber-500" /></div>
                </div>
              </div>
              <p className="text-xs text-slate-500 bg-slate-800/50 rounded p-3 border border-slate-700">💡 <strong className="text-slate-300">Markup Matrix</strong> — set tiered markup by part cost. First match wins. Leave "Up To" blank on the last tier for a catch-all.</p>
              {(['retail','commercial'] as const).map(type => (
                <div key={type} className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-sm text-white uppercase">{type==='retail'?'🧑 Retail':'🏢 Commercial'} Markup Matrix</h4>
                    <button onClick={()=>addTier(type)} className="text-xs text-indigo-400 hover:text-white border border-indigo-500/30 px-2 py-1 rounded">+ Tier</button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 mb-1 text-[10px] font-bold text-slate-500 uppercase"><div className="col-span-5">Part Cost Up To ($)</div><div className="col-span-5">Markup %</div><div className="col-span-2"></div></div>
                  {settingsForm[type==='retail'?'markup_matrix_retail':'markup_matrix_commercial'].map((tier,i,arr) => (
                    <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                      <div className="col-span-5"><input type="number" placeholder="∞" value={tier.upTo} onChange={e=>updateMatrix(type,i,'upTo',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm font-mono" /></div>
                      <div className="col-span-5 relative"><input type="number" value={tier.markupPct} onChange={e=>updateMatrix(type,i,'markupPct',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 pr-6 rounded text-sm font-mono" /><span className="absolute right-2 top-2 text-slate-500 text-xs">%</span></div>
                      <div className="col-span-2 flex justify-end"><button onClick={()=>removeTier(type,i)} className="text-red-400 hover:text-red-300 font-bold px-2" disabled={arr.length<=1}>×</button></div>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Flat-rate fallback (if matrix is empty)</label>
                    <div className="relative mt-1">
                      <input type="number" value={type==='retail'?settingsForm.parts_markup_retail:settingsForm.parts_markup_commercial} onChange={e=>setSettingsForm({...settingsForm,[type==='retail'?'parts_markup_retail':'parts_markup_commercial']:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 pr-7 text-white outline-none text-sm" />
                      <span className="absolute right-2 top-2 text-slate-500 text-xs">%</span>
                    </div>
                  </div>
                </div>
              ))}
              {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
              {settingsSaved && <p className="text-green-400 text-sm font-bold">✓ Settings saved!</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>{setShowSettings(false);setSettingsSaved(false);setSettingsError('')}} className="flex-1 py-3 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Cancel</button>
                <button onClick={handleSaveSettings} disabled={savingSettings} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded disabled:opacity-50">{savingSettings?'Saving...':'Save Settings'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">{modalMode==='add'?'Add New User':'Edit User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" value={formData.firstName} onChange={e=>setFormData({...formData,firstName:e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full" />
                <input placeholder="Last Name" value={formData.lastName} onChange={e=>setFormData({...formData,lastName:e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full" />
              </div>
              {modalMode==='add' && (<>
                <input type="email" placeholder="Email Address" required value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full" />
                <input type="password" placeholder="Temporary Password" required value={formData.password} onChange={e=>setFormData({...formData,password:e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full" />
              </>)}
              <div>
                <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Role</label>
                <select value={formData.role} onChange={e=>setFormData({...formData,role:e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-3 text-white w-full">
                  <option value="technician">Technician</option><option value="advisor">Service Advisor</option><option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 py-3 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded">{formLoading?'Saving...':'Save User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}