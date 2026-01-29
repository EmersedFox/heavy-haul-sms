'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function InvoicePage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [job, setJob] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState({ description: '', qty: 1, price: 0, type: 'labor' })

  const fetchJob = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        vehicles (
          year, make, model, vin, unit_number,
          customers (first_name, last_name, phone, email, company_name, billing_address)
        ),
        job_items (*)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      router.push('/dashboard')
    } else {
      setJob(data)
      setItems(data.job_items || [])
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { fetchJob() }, [fetchJob])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.description) return
    const { data } = await supabase.from('job_items').insert([{
        job_id: id,
        description: newItem.description,
        quantity: newItem.qty,
        unit_price: newItem.price,
        item_type: newItem.type
      }]).select().single()
    if (data) {
      setItems([...items, data])
      setNewItem({ description: '', qty: 1, price: 0, type: 'labor' }) 
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from('job_items').delete().eq('id', itemId)
    setItems(items.filter(i => i.id !== itemId))
  }

  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

  if (loading) return <div className="p-10 bg-white min-h-screen text-black">Loading Invoice...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* CONTROL BAR (Hidden on Print) */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden shadow-md sticky top-0 z-50">
        <div className="font-bold text-amber-500">INVOICE EDITOR</div>
        <div className="flex gap-4">
          <Link href={`/jobs/${id}`} className="px-4 py-2 text-slate-300 hover:text-white">
            ← Back to Ticket
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded">
            🖨️ Print PDF
          </button>
        </div>
      </div>

      {/* PAPER INVOICE AREA - COMPACT MODE */}
      <div className="max-w-5xl mx-auto bg-white p-8 min-h-screen shadow-lg print:shadow-none print:p-0">
        
        {/* Header - Reduced Height */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
             <h1 className="text-3xl font-extrabold uppercase tracking-tighter">Heavy Haul <span className="text-amber-600">Auto Service</span> LLC</h1>
             <div className="text-sm text-slate-600 mt-1">
                <p>P.O. Box 4742, Carmel, IN 46032</p>
                <p className="font-bold">463-777-4429</p>
             </div>
          </div>
          <div className="text-right">
             <div className="text-4xl font-black text-slate-100 uppercase">INVOICE</div>
             <p className="text-slate-500 text-sm mt-1">Invoice #: {job.id.slice(0,8)}</p>
             <p className="text-slate-500 text-sm">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Bill To / Vehicle - Compact Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
           <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bill To</h3>
              <p className="font-bold text-base">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
              {job.vehicles.customers.company_name && <p className="font-medium">{job.vehicles.customers.company_name}</p>}
              {job.vehicles.customers.billing_address && (
                <p className="text-slate-600 whitespace-pre-wrap">{job.vehicles.customers.billing_address}</p>
              )}
              <p className="text-slate-500 mt-1">{job.vehicles.customers.phone}</p>
           </div>
           <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle</h3>
              <p className="font-bold text-base">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
              <div className="grid grid-cols-2 gap-4 mt-1">
                 <p className="text-slate-600 font-mono"><span className="text-slate-400">VIN:</span> {job.vehicles.vin || 'N/A'}</p>
                 <p className="text-slate-600"><span className="text-slate-400">Unit:</span> {job.vehicles.unit_number || 'N/A'}</p>
              </div>
           </div>
        </div>

        {/* Line Items - Condensed Table */}
        <table className="w-full text-left mb-6 text-sm">
           <thead className="border-b border-slate-300">
             <tr className="text-slate-500 text-xs uppercase">
               <th className="py-2 w-1/2">Description</th>
               <th className="py-2 text-center w-24">Type</th>
               <th className="py-2 text-center w-16">Qty</th>
               <th className="py-2 text-right w-24">Rate</th>
               <th className="py-2 text-right w-24">Total</th>
               <th className="print:hidden w-8"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {items.map((item) => (
               <tr key={item.id} className="hover:bg-slate-50">
                 <td className="py-1.5 font-medium">{item.description}</td>
                 <td className="py-1.5 text-center text-xs uppercase text-slate-400">{item.item_type}</td>
                 <td className="py-1.5 text-center">{item.quantity}</td>
                 <td className="py-1.5 text-right">${item.unit_price.toFixed(2)}</td>
                 <td className="py-1.5 text-right font-bold">${(item.quantity * item.unit_price).toFixed(2)}</td>
                 <td className="print:hidden text-right py-1.5">
                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 font-bold hover:text-red-600 px-2">×</button>
                 </td>
               </tr>
             ))}
           </tbody>
        </table>

        {/* EDITOR FORM (Hidden on Print) */}
        <form onSubmit={handleAddItem} className="print:hidden bg-slate-100 p-3 rounded mb-8 flex gap-2 text-sm">
           <input className="flex-grow p-2 border rounded" placeholder="New Item..." value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
           <select className="p-2 border rounded" value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})}>
              <option value="labor">Labor</option><option value="part">Part</option><option value="fee">Fee</option>
           </select>
           <input type="number" className="w-16 p-2 border rounded" placeholder="Qty" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: parseFloat(e.target.value)})} />
           <input type="number" className="w-24 p-2 border rounded" placeholder="$" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} />
           <button className="bg-slate-900 text-white px-4 rounded font-bold">Add</button>
        </form>

        {/* TOTALS - Compact */}
        <div className="flex justify-end text-sm">
           <div className="w-56">
              <div className="flex justify-between py-1 text-slate-600"><span>Subtotal</span> <span>${grandTotal.toFixed(2)}</span></div>
              <div className="flex justify-between py-1 text-slate-600"><span>Tax (7%)</span> <span>${(grandTotal * 0.07).toFixed(2)}</span></div>
              <div className="flex justify-between py-2 text-xl font-black border-t-2 border-slate-900 mt-1">
                 <span>Total</span>
                 <span>${(grandTotal * 1.07).toFixed(2)}</span>
              </div>
           </div>
        </div>

        {/* FOOTER MESSAGE - Small and Bottom */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-slate-400 text-xs">
           <p className="mb-1">Thank you for your business. Please make checks payable to Heavy Haul Auto Service LLC.</p>
           <p>Payment is due upon receipt. A 1.5% monthly service charge applies to overdue accounts.</p>
        </div>
      </div>
    </div>
  )
}