'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const fmt = (n: any) => `$${(Math.round((Number(n)||0)*100)/100).toFixed(2)}`
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function POsPage() {
  const router = useRouter()
  const [pos,      setPos]     = useState<any[]>([])
  const [loading,  setLoading] = useState(true)
  const [year,     setYear]    = useState(new Date().getFullYear())
  const [month,    setMonth]   = useState(new Date().getMonth()) // 0-indexed
  const [role,     setRole]    = useState('')
  const [expanded, setExpanded] = useState<string|null>(null)

  // Edit state
  const [editingPO,   setEditingPO]   = useState<any>(null)
  const [editForm,    setEditForm]    = useState<any>(null)
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setRole(profile?.role || 'technician')
      const { data } = await supabase.from('purchase_orders').select('*, jobs(id, vehicles(year,make,model,customers(first_name,last_name)))').order('created_at', { ascending: false })
      if (data) setPos(data)
      setLoading(false)
    }
    load()
  }, [router])

  const filtered = useMemo(() => {
    return pos.filter(po => {
      const d = new Date(po.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [pos, year, month])

  const monthTotal = filtered.reduce((s, po) => s + (Number(po.total_cost)||0), 0)

  const statusColor: Record<string,string> = { ordered:'text-amber-400', partial:'text-blue-400', received:'text-green-400', cancelled:'text-slate-500' }
  const statusBg: Record<string,string> = { ordered:'bg-amber-500/10 border-amber-500/30', partial:'bg-blue-500/10 border-blue-500/30', received:'bg-green-500/10 border-green-500/30', cancelled:'bg-slate-800 border-slate-700' }

  const canManage = role === 'admin' || role === 'advisor'

  const openEdit = (po: any) => {
    setEditingPO(po)
    setEditForm({
      vendor: po.vendor,
      status: po.status,
      expectedDate: po.expected_date || '',
      notes: po.notes || '',
      items: (po.line_items||[]).map((i:any,idx:number)=>({...i, _id: idx}))
    })
  }

  const updateEditItem = (idx: number, field: string, val: any) => {
    setEditForm((prev: any) => ({ ...prev, items: prev.items.map((i:any, n:number) => n===idx ? {...i,[field]:val} : i) }))
  }
  const addEditItem = () => setEditForm((prev: any) => ({ ...prev, items: [...prev.items, {_id:Date.now(), partNumber:'', name:'', qty:1, unitCost:0}] }))
  const removeEditItem = (idx: number) => setEditForm((prev: any) => ({ ...prev, items: prev.items.filter((_:any,n:number)=>n!==idx) }))

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      const updates: any = {
        vendor: editForm.vendor, status: editForm.status,
        expected_date: editForm.expectedDate || null,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString(),
        line_items: editForm.items.map(({ _id, ...rest }: any) => rest),
      }
      if (editForm.status === 'received' && !editingPO.received_date) {
        updates.received_date = new Date().toISOString().slice(0,10)
      }
      const { data, error } = await supabase.from('purchase_orders').update(updates).eq('id', editingPO.id).select().single()
      if (error) throw error
      setPos(prev => prev.map(p => p.id === editingPO.id ? data : p))
      setEditingPO(null)
      showToast('PO updated!')
    } catch (err: any) { alert(err.message) }
    finally { setSavingEdit(false) }
  }

  const handleDelete = async (poId: string) => {
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', poId)
      if (error) throw error
      setPos(prev => prev.filter(p => p.id !== poId))
      setDeleteConfirm(null)
      showToast('PO deleted.')
    } catch (err: any) { alert(err.message) }
  }

  const years = Array.from(new Set(pos.map(p => new Date(p.created_at).getFullYear()))).sort((a,b)=>b-a)
  if (years.length === 0) years.push(new Date().getFullYear())

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading POs...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-500 text-slate-900 font-bold px-5 py-3 rounded-lg shadow-xl">{toast}</div>}

      {/* Edit Modal */}
      {editingPO && editForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl my-4">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              Edit PO <span className="font-mono text-amber-400 text-sm">{editingPO.po_number}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Vendor</label>
                <input value={editForm.vendor} onChange={e=>setEditForm({...editForm,vendor:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Status</label>
                <select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none">
                  <option value="ordered">Ordered</option><option value="partial">Partial</option><option value="received">Received</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Expected Date</label>
                <input type="date" value={editForm.expectedDate} onChange={e=>setEditForm({...editForm,expectedDate:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Parts</label>
                <button onClick={addEditItem} className="text-xs text-indigo-400 hover:text-white border border-indigo-500/30 px-2 py-1 rounded">+ Add</button>
              </div>
              {editForm.items.map((item: any, i: number) => (
                <div key={item._id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-2"><input placeholder="Part #" value={item.partNumber||''} onChange={e=>updateEditItem(i,'partNumber',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm font-mono" /></div>
                  <div className="col-span-4"><input placeholder="Name" value={item.name||''} onChange={e=>updateEditItem(i,'name',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm" /></div>
                  <div className="col-span-2"><input type="number" value={item.qty} onChange={e=>updateEditItem(i,'qty',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded text-sm text-center" /></div>
                  <div className="col-span-3 relative"><span className="absolute left-2 top-2 text-xs text-slate-500">$</span><input type="number" value={item.unitCost} onChange={e=>updateEditItem(i,'unitCost',e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white p-2 pl-5 rounded text-sm" /></div>
                  <div className="col-span-1 flex justify-end"><button onClick={()=>removeEditItem(i)} className="text-red-400 font-bold px-2">×</button></div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Notes</label>
              <textarea value={editForm.notes} onChange={e=>setEditForm({...editForm,notes:e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white outline-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={()=>setEditingPO(null)} className="flex-1 py-3 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded disabled:opacity-50">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-20 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div>
            <Link href="/dashboard" className="text-slate-500 hover:text-white text-sm mb-1 block">← Dashboard</Link>
            <h1 className="text-2xl font-bold text-white">📦 Purchase Orders</h1>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded outline-none text-sm">
              {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded outline-none text-sm">
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={()=>window.print()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-sm print:hidden">🖨️ Print Month</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Month summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase">POs This Month</p>
            <p className="text-3xl font-black text-white mt-1">{filtered.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Ordered</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{fmt(monthTotal)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase">Pending Receipt</p>
            <p className="text-3xl font-black text-purple-400 mt-1">{filtered.filter(p=>p.status==='ordered'||p.status==='partial').length}</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4">📦</div>
            <p className="font-bold text-lg">No POs in {MONTHS[month]} {year}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(po => {
              const vehicle = po.jobs?.vehicles
              const customer = vehicle?.customers
              const isOpen = expanded === po.id
              return (
                <div key={po.id} className={`bg-slate-900 rounded-xl border transition-colors ${isOpen?'border-indigo-500/50':'border-slate-800 hover:border-slate-700'}`}>
                  <div className="p-5 flex justify-between items-start">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>setExpanded(isOpen?null:po.id)}>
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-mono font-black text-white text-sm">{po.po_number}</span>
                        <span className={`text-xs font-bold border px-2 py-0.5 rounded uppercase ${statusBg[po.status]||''} ${statusColor[po.status]||''}`}>{po.status}</span>
                        <span className="text-slate-500 text-xs">{new Date(po.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="font-bold text-slate-200">{po.vendor}</p>
                      {customer && <p className="text-xs text-slate-500 mt-0.5">{customer.first_name} {customer.last_name} · {vehicle?.year} {vehicle?.make} {vehicle?.model}</p>}
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className="font-bold text-white text-lg">{fmt(po.total_cost)}</span>
                      {canManage && (
                        <div className="flex gap-2 print:hidden">
                          <button onClick={()=>openEdit(po)} className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">✎ Edit</button>
                          {deleteConfirm === po.id ? (
                            <div className="flex gap-1">
                              <button onClick={()=>handleDelete(po.id)} className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded">Confirm</button>
                              <button onClick={()=>setDeleteConfirm(null)} className="px-2 py-1.5 text-xs text-slate-400 hover:text-white">✕</button>
                            </div>
                          ) : (
                            <button onClick={()=>setDeleteConfirm(po.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-red-900/40 text-red-400 rounded border border-slate-700">🗑</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-slate-800 pt-4">
                      <div className="flex gap-6 text-xs text-slate-400 mb-4 flex-wrap">
                        <span>Ordered by: <strong className="text-slate-200">{po.ordered_by_name}</strong></span>
                        {po.expected_date && <span>Expected: <strong className="text-amber-400">{po.expected_date}</strong></span>}
                        {po.received_date && <span>Received: <strong className="text-green-400">{po.received_date}</strong></span>}
                        {po.jobs?.id && <Link href={`/jobs/${po.jobs.id}`} className="text-indigo-400 hover:text-white">Open Job →</Link>}
                      </div>
                      <table className="w-full text-sm">
                        <thead><tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                          <th className="pb-2 text-left">Part #</th><th className="pb-2 text-left">Name</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit</th><th className="pb-2 text-right">Total</th>
                        </tr></thead>
                        <tbody>
                          {(po.line_items||[]).map((li:any,i:number)=>(
                            <tr key={i} className="border-b border-slate-800/50">
                              <td className="py-1.5 font-mono text-xs text-slate-400">{li.partNumber||'—'}</td>
                              <td className="py-1.5 text-slate-200">{li.name}</td>
                              <td className="py-1.5 text-center">{li.qty}</td>
                              <td className="py-1.5 text-right text-slate-400">{fmt(li.unitCost)}</td>
                              <td className="py-1.5 text-right font-bold">{fmt(li.qty*li.unitCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {po.notes && <p className="text-xs text-slate-500 mt-3 italic">{po.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Print footer */}
        <div className="hidden print:block mt-10 pt-6 border-t border-slate-300 text-center text-sm text-slate-500">
          <p>Heavy Haul Auto Service LLC · Purchase Orders: {MONTHS[month]} {year}</p>
          <p>Total: {fmt(monthTotal)} · Printed: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
