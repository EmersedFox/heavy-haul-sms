'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '', // Added Address
    year: '',
    make: '',
    model: '',
    vin: '',
    unit_number: '',
    complaint: ''
  })

  // Search Logic
  useEffect(() => {
    const searchCustomers = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([])
        return
      }
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`)
        .limit(5)
      
      if (data) setSearchResults(data)
    }
    // Debounce slightly so it doesn't fire on every keystroke instantly
    const timer = setTimeout(searchCustomers, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Select a Customer
  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id)
    setFormData({
      ...formData,
      firstName: cust.first_name,
      lastName: cust.last_name,
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.billing_address || ''
    })
    setSearchResults([]) // Clear dropdown
    setSearchTerm('') 
  }

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let customerId = selectedCustomerId

      // 1. If NO customer selected, Create New
      if (!customerId) {
        const { data: customer, error: custError } = await supabase
          .from('customers')
          .insert([{ 
            first_name: formData.firstName, 
            last_name: formData.lastName,
            phone: formData.phone,
            email: formData.email,
            billing_address: formData.address
          }])
          .select()
          .single()
        
        if (custError) throw custError
        customerId = customer.id
      } else {
        // Optional: Update address if they changed it
        await supabase
          .from('customers')
          .update({ billing_address: formData.address, phone: formData.phone })
          .eq('id', customerId)
      }

      // 2. Create Vehicle
      const { data: vehicle, error: vehError } = await supabase
        .from('vehicles')
        .insert([{
          customer_id: customerId,
          year: parseInt(formData.year) || 0,
          make: formData.make,
          model: formData.model,
          vin: formData.vin,
          unit_number: formData.unit_number
        }])
        .select()
        .single()

      if (vehError) throw vehError

      // 3. Create Job
      const { error: jobError } = await supabase
        .from('jobs')
        .insert([{
          vehicle_id: vehicle.id,
          customer_complaint: formData.complaint,
          status: 'scheduled'
        }])

      if (jobError) throw jobError

      router.push('/dashboard')

    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-amber-500">New Intake</h1>
        
        {/* CUSTOMER SEARCH BAR */}
        <div className="relative mb-8 bg-slate-900 p-4 rounded border border-slate-700">
          <label className="block text-sm font-bold mb-2 text-indigo-400">Search Existing Customer</label>
          <input 
            type="text"
            placeholder="Type name or company..."
            className="w-full bg-slate-950 border border-slate-600 rounded p-3 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl max-h-60 overflow-y-auto">
              {searchResults.map(cust => (
                <div 
                  key={cust.id} 
                  onClick={() => selectCustomer(cust)}
                  className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-0"
                >
                  <div className="font-bold text-white">{cust.first_name} {cust.last_name}</div>
                  <div className="text-xs text-slate-400">{cust.company_name} • {cust.phone}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Customer */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">
              Customer Info {selectedCustomerId && <span className="text-green-500 text-sm">(Linked)</span>}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} required className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="address" placeholder="Billing Address" value={formData.address} onChange={handleChange} className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* Section 2: Vehicle */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Vehicle Details</h2>
            <div className="grid grid-cols-3 gap-4">
              <input name="year" placeholder="Year" type="number" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="make" placeholder="Make" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="model" placeholder="Model" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
              <input name="vin" placeholder="VIN" onChange={handleChange} className="col-span-2 bg-slate-800 border-slate-700 rounded p-3 text-white font-mono" />
              <input name="unit_number" placeholder="Unit #" onChange={handleChange} className="bg-slate-800 border-slate-700 rounded p-3 text-white" />
            </div>
          </div>

          {/* Section 3: Complaint */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
            <h2 className="text-xl font-semibold mb-4 text-slate-300">Issue</h2>
            <textarea name="complaint" placeholder="Customer Complaint..." onChange={handleChange} rows={3} className="w-full bg-slate-800 border-slate-700 rounded p-3 text-white" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-lg text-lg">
            {loading ? 'Processing...' : 'Start Job'}
          </button>
        </form>
      </div>
    </div>
  )
}