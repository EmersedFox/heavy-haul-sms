'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    year: '',
    make: '',
    model: '',
    vin: '',
    complaint: ''
  })

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Create Customer
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .insert([{ 
          first_name: formData.firstName, 
          last_name: formData.lastName,
          phone: formData.phone 
        }])
        .select()
        .single()

      if (custError) throw custError

      // 2. Create Vehicle (Linked to Customer)
      const { data: vehicle, error: vehError } = await supabase
        .from('vehicles')
        .insert([{
          customer_id: customer.id,
          year: parseInt(formData.year) || 0,
          make: formData.make,
          model: formData.model,
          vin: formData.vin
        }])
        .select()
        .single()

      if (vehError) throw vehError

      // 3. Create Job (Linked to Vehicle)
      const { error: jobError } = await supabase
        .from('jobs')
        .insert([{
          vehicle_id: vehicle.id,
          customer_complaint: formData.complaint,
          status: 'scheduled'
        }])

      if (jobError) throw jobError

      // Success! Go back to dashboard
      router.push('/dashboard')

    } catch (error: any) {
      alert('Error creating job: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-amber-500">New Intake</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Customer */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Customer Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName" placeholder="First Name" onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="lastName" placeholder="Last Name" onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="phone" placeholder="Phone Number" onChange={handleChange} required className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* Section 2: Vehicle */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Vehicle Details</h2>
            <div className="grid grid-cols-3 gap-4">
              <input name="year" placeholder="Year" type="number" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="make" placeholder="Make (e.g. Peterbilt)" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="model" placeholder="Model" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="vin" placeholder="VIN (Optional)" onChange={handleChange} className="col-span-3 bg-slate-800 border-slate-700 rounded p-3 text-white font-mono" />
            </div>
          </div>

          {/* Section 3: The Issue */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">What's wrong?</h2>
            <textarea 
              name="complaint" 
              placeholder="Describe the issue (e.g. Air leak in rear, check engine light on)" 
              onChange={handleChange}
              rows={4}
              className="w-full bg-slate-800 border-slate-700 rounded p-3 text-white"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-lg text-lg transition-colors"
          >
            {loading ? 'Creating Ticket...' : 'Create Ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}