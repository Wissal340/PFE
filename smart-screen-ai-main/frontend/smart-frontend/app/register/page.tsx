'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { getMe, registerDevice } from '../../lib/api'

const MapPicker = dynamic(() => import('../../components/map-picker'), {
  ssr: false,
})

type Me = {
  id: number
  full_name: string
  email: string
  role: 'admin' | 'technicien' | 'viewer'
  is_active: boolean
  is_approved: boolean
}

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkPermission() {
      try {
        const me = (await getMe()) as Me | null

        if (!me) {
          setAllowed(false)
          return
        }

        setAllowed(me.role === 'admin' || me.role === 'technicien')
      } catch (err) {
        console.error(err)
        setAllowed(false)
      } finally {
        setChecking(false)
      }
    }

    checkPermission()
  }, [])

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
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Erreur lors de la création du device')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        Vérification des permissions...
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-300">Accès refusé</h2>
          <p className="mt-2 text-slate-300">
            Vous n'avez pas les permissions pour enregistrer un écran.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6">
        <div className="rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <h1 className="text-4xl font-bold text-white">Register Device</h1>
          <p className="mt-2 text-slate-300">
            Ajouter un nouvel écran et définir sa position sur la carte
          </p>
        </div>

        <div className="space-y-5 rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <input
            type="text"
            placeholder="Nom du device"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500/50"
          />

          <input
            type="text"
            placeholder="Localisation"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100"
          />

          <div className="overflow-hidden rounded-2xl border border-slate-700">
            <MapPicker value={coords} onChange={setCoords} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              readOnly
              value={coords?.lat ?? ''}
              placeholder="Latitude"
              className="rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-300"
            />
            <input
              readOnly
              value={coords?.lng ?? ''}
              placeholder="Longitude"
              className="rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-300"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!name || loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le device'}
          </button>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
              <div>
                <b>ID:</b> {result.id}
              </div>
              <div className="break-all">
                <b>API Key:</b> {result.api_key}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}