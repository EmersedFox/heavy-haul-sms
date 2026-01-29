'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function JobDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data State
  const [job, setJob] = useState<any>(null)
  const [items, setItems] = useState<any[]>([]) // Stores parts/labor
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')

  // New Item Form State
  const [newItem, setNewItem] = useState({ description: '', qty: 1, price: 0, type: 'labor' })

  const fetchJob = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        vehicles (
          year, make, model, vin, unit_number,
          customers (first_name, last_name, phone, company_name, billing_address, email)
        ),
        job_items (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      alert('Error fetching job')
      router.push('/dashboard')
    } else {
      setJob(data)
      setItems(data.job_items || [])
      setNotes(data.tech_diagnosis || '')
      setStatus(data.status)
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  // Save Main Info
  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('jobs')
      .update({ tech_diagnosis: notes, status: status })
      .eq('id', id)
    if (error) alert('Error saving')
    setSaving(false)
  }

  // Add Line Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.description) return

    const { data, error } = await supabase
      .from('job_items')
      .insert([{
        job_id: id,
        description: newItem.description,
        quantity: newItem.qty,
        unit_price: newItem.price,
        item_type: newItem.type
      }])
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else {
      setItems([...items, data]) // Update UI instantly
      setNewItem({ description: '', qty: 1, price: 0, type: 'labor' }) // Reset form
    }
  }

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from('job_items').delete().eq('id', itemId)
    if (!error) {
      setItems(items.filter(i => i.id !== itemId))
    }
  }

  // Calculate Total
  const grandTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-10">Loading Order...</div>

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white text-slate-900 print:text-black">
      
      {/* HEADER (Hidden when printing) */}
      <div className="bg-slate-900 text-white border-b border-slate-800 p-6 sticky top-0 z-10 flex justify-between items-center shadow-md print:hidden">
        <div>
          <div className="text-slate-400 text-sm font-mono mb-1">JOB #{job.id.slice(0, 8)}</div>
          <h1 className="text-2xl font-bold">
            {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
          </h1>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            Back
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">
            🖨️ Print Invoice
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded shadow-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* INVOICE LAYOUT */}
      <div className="max-w-5xl mx-auto p-8 print:p-0">
        
        {/* Invoice Header (Visible on Print) */}
        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-200 pb-8">
          <div>
            {/* You can replace this text with your <Image /> logo if you want it on the invoice */}
            <h1 className="text-3xl font-extrabold text-slate-900 uppercase tracking-tighter">Heavy Haul <span className="text-amber-600">Auto</span></h1>
            <p className="text-slate-500 mt-1">Carmel / Indianapolis, IN</p>
            <p className="text-slate-500">463-777-4429</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-700">INVOICE</h2>
            <p className="text-slate-500">Date: {new Date().toLocaleDateString()}</p>
            <p className="text-slate-500">Ticket #: {job.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* Customer & Vehicle Grid */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
            <p className="font-bold text-lg">{job.vehicles.customers.first_name} {job.vehicles.customers.last_name}</p>
            {job.vehicles.customers.company_name && <p>{job.vehicles.customers.company_name}</p>}
            <p className="text-slate-600">{job.vehicles.customers.phone}</p>
            <p className="text-slate-600">{job.vehicles.customers.email}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vehicle Details</h3>
            <p className="font-bold text-lg">{job.vehicles.year} {job.vehicles.make} {job.vehicles.model}</p>
            <p className="text-slate-600 font-mono">VIN: {job.vehicles.vin || 'N/A'}</p>
            <p className="text-slate-600">Unit #: {job.vehicles.unit_number || 'N/A'}</p>
            <p className="text-slate-600 mt-2"><span className="font-bold">Complaint:</span> {job.customer_complaint}</p>
          </div>
        </div>

        {/* WORK TABLE */}
        <div className="mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-600 text-sm uppercase">
                <th className="py-3 w-1/2">Description</th>
                <th className="py-3 text-center">Type</th>
                <th className="py-3 text-center">Qty/Hrs</th>
                <th className="py-3 text-right">Rate</th>
                <th className="py-3 text-right">Total</th>
                <th className="py-3 w-10 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-4 font-medium">{item.description}</td>
                  <td className="py-4 text-center text-xs uppercase text-slate-500 bg-slate-100 rounded px-2 py-1 mx-auto w-min">{item.item_type}</td>
                  <td className="py-4 text-center">{item.quantity}</td>
                  <td className="py-4 text-right">${item.unit_price.toFixed(2)}</td>
                  <td className="py-4 text-right font-bold">${(item.quantity * item.unit_price).toFixed(2)}</td>
                  <td className="py-4 text-right print:hidden">
                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 text-xl font-bold">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ADD ITEM FORM (Hidden on Print) */}
          <form onSubmit={handleAddItem} className="mt-4 flex gap-2 print:hidden bg-slate-100 p-4 rounded-lg">
            <input 
              placeholder="Description (e.g. Brake Pads)" 
              className="flex-grow p-2 border border-slate-300 rounded"
              value={newItem.description}
              onChange={e => setNewItem({...newItem, description: e.target.value})}
            />
            <select 
              className="p-2 border border-slate-300 rounded"
              value={newItem.type}
              onChange={e => setNewItem({...newItem, type: e.target.value})}
            >
              <option value="labor">Labor</option>
              <option value="part">Part</option>
              <option value="sublet">Sublet</option>
              <option value="fee">Fee</option>
            </select>
            <input 
              type="number" placeholder="Qty" className="w-20 p-2 border border-slate-300 rounded"
              value={newItem.qty}
              onChange={e => setNewItem({...newItem, qty: parseFloat(e.target.value)})}
            />
            <input 
              type="number" placeholder="Price" className="w-24 p-2 border border-slate-300 rounded"
              value={newItem.price}
              onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
            />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded font-bold hover:bg-slate-800">Add</button>
          </form>
        </div>

        {/* TOTALS */}
        <div className="flex justify-end border-t-2 border-slate-200 pt-6">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (7%)</span>
              <span>${(grandTotal * 0.07).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-extrabold text-slate-900 border-t border-slate-200 pt-3">
              <span>Total</span>
              <span>${(grandTotal * 1.07).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* FOOTER NOTES */}
        <div className="mt-12 text-sm text-slate-500 border-t border-slate-200 pt-6">
          <p className="font-bold mb-2">Technician Notes:</p>
          <textarea 
            className="w-full bg-transparent resize-none outline-none text-slate-700 font-mono"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No notes entered."
          />
        </div>

        {/* STATUS SELECTOR (Print Hidden) */}
        <div className="mt-8 print:hidden bg-amber-50 p-6 rounded border border-amber-200">
          <label className="font-bold text-amber-900 block mb-2">Job Status:</label>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="w-full p-2 border border-amber-300 rounded bg-white"
          >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_shop">In Shop</option>
              <option value="waiting_parts">Waiting on Parts</option>
              <option value="ready">Ready for Pickup</option>
              <option value="invoiced">Invoiced / Closed</option>
          </select>
        </div>

      </div>
    </div>
  )
}