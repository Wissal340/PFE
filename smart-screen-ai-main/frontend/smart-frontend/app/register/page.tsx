'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { registerDevice } from '../../lib/api'

const MapPicker = dynamic(() => import('../../components/map-picker'), {
  ssr: false,
})

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    try {
      setLoading(true)
      setError('')
      setResult(null)

      const data = await registerDevice({
        name,
        location: location || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      })

      setResult(data)
    } catch (err) {
      console.error(err)
      setError('Failed to register device')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register Device</h1>
        <p className="text-sm text-slate-500">
          Choisissez la position du screen sur la carte
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <input
          type="text"
          placeholder="Device name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border px-4 py-3 outline-none"
        />

        <input
          type="text"
          placeholder="Location label (ex: Sfax centre)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-xl border px-4 py-3 outline-none"
        />

        <MapPicker value={coords} onChange={setCoords} />

        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="text"
            readOnly
            value={coords?.lat ?? ''}
            placeholder="Latitude"
            className="w-full rounded-xl border bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="text"
            readOnly
            value={coords?.lng ?? ''}
            placeholder="Longitude"
            className="w-full rounded-xl border bg-slate-50 px-4 py-3 outline-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name || loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Register'}
        </button>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border bg-slate-50 p-4 text-sm">
            <div><b>Device ID:</b> {result.id}</div>
            <div className="mt-2 break-all"><b>API Key:</b> {result.api_key}</div>
          </div>
        )}
      </div>
    </div>
  )
}