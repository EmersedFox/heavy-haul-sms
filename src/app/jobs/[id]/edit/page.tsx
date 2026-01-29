'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditJobPage() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Store IDs to know what rows to update
  const [ids, setIds] = useState({ customerId: '', vehicleId: '' })

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    companyName: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    unit_number: '',
    type: 'car', // <--- Added Type
    complaint: ''
  })

  useEffect(() => {
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          vehicles (
            id, year, make, model, vin, unit_number, vehicle_type,
            customers (id, first_name, last_name, phone, email, billing_address, company_name)
          )
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        alert('Error loading job')
        router.push(`/jobs/${id}`)
        return
      }

      // Pre-fill the form
      setIds({ customerId: data.vehicles.customers.id, vehicleId: data.vehicles.id })
      setFormData({
        firstName: data.vehicles.customers.first_name,
        lastName: data.vehicles.customers.last_name,
        phone: data.vehicles.customers.phone || '',
        email: data.vehicles.customers.email || '',
        address: data.vehicles.customers.billing_address || '',
        companyName: data.vehicles.customers.company_name || '',
        year: data.vehicles.year,
        make: data.vehicles.make,
        model: data.vehicles.model,
        vin: data.vehicles.vin || '',
        unit_number: data.vehicles.unit_number || '',
        type: data.vehicles.vehicle_type || 'car', // <--- Load Type
        complaint: data.customer_complaint
      })
      setLoading(false)
    }

    fetchJob()
  }, [id, router])

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // 1. Update Customer
      const { error: custError } = await supabase
        .from('customers')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          billing_address: formData.address,
          company_name: formData.companyName
        })
        .eq('id', ids.customerId)
      if (custError) throw custError

      // 2. Update Vehicle (Including Type)
      const { error: vehError } = await supabase
        .from('vehicles')
        .update({
          year: parseInt(formData.year) || 0,
          make: formData.make,
          model: formData.model,
          vin: formData.vin,
          unit_number: formData.unit_number,
          vehicle_type: formData.type // <--- Save Type
        })
        .eq('id', ids.vehicleId)
      if (vehError) throw vehError

      // 3. Update Job (Complaint)
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ customer_complaint: formData.complaint })
        .eq('id', id)
      if (jobError) throw jobError

      // Done - Go back to ticket
      router.push(`/jobs/${id}`)

    } catch (error: any) {
      alert('Error updating: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 bg-slate-950 text-white">Loading Editor...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500">Edit Ticket Details</h1>
          <Link href={`/jobs/${id}`} className="text-slate-400 hover:text-white">Cancel</Link>
        </div>
        
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* CUSTOMER EDIT */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Company (Optional)" className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Billing Address" rows={2} className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* VEHICLE EDIT */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Vehicle Details</h2>
            
            {/* TYPE SELECTOR - NEW! */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Vehicle Type</label>
              <div className="flex gap-4">
                {['car', 'heavy_truck', 'trailer'].map((type) => (
                  <label key={type} className={`flex-1 cursor-pointer border rounded p-3 text-center uppercase font-bold text-sm transition-colors ${
                     formData.type === type 
                       ? 'bg-amber-500 text-slate-900 border-amber-500' 
                       : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>
                    <input 
                      type="radio" 
                      name="type" 
                      value={type} 
                      checked={formData.type === type} 
                      onChange={handleChange} 
                      className="hidden" 
                    />
                    {type.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <input name="year" type="number" value={formData.year} onChange={handleChange} placeholder="Year" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="make" value={formData.make} onChange={handleChange} placeholder="Make" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="model" value={formData.model} onChange={handleChange} placeholder="Model" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="vin" value={formData.vin} onChange={handleChange} placeholder="VIN" className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white font-mono" />
              <input name="unit_number" value={formData.unit_number} onChange={handleChange} placeholder="Unit #" className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* COMPLAINT EDIT */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Original Complaint</h2>
            <textarea name="complaint" value={formData.complaint} onChange={handleChange} rows={3} className="w-full bg-slate-800 border-slate-700 rounded p-3 text-white" />
          </div>

          <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-lg text-lg">
            {saving ? 'Saving Updates...' : 'Update Ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}