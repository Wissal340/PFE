'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDevices, getToken } from '../../../lib/api'

const DevicesMap = dynamic(() => import('../../../components/devices-map'), {
  ssr: false,
})

type Device = {
  id: string
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: string
  is_online?: boolean
}

export default function DevicesMapPage() {
  const searchParams = useSearchParams()
  const focusedId = searchParams.get('focus')

  const [devices, setDevices] = useState<Device[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setError('')

        if (!getToken()) {
          setError('Veuillez vous connecter')
          setLoading(false)
          return
        }

        const data = await getDevices()
        setDevices(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setError('Impossible de charger les devices')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filtered = useMemo(() => {
    let result = devices

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((d) =>
        `${d.name} ${d.location ?? ''}`.toLowerCase().includes(q)
      )
    }

    if (statusFilter === 'online') {
      result = result.filter(
        (d) => d.status === 'online' || d.is_online === true
      )
    }

    if (statusFilter === 'offline') {
      result = result.filter(
        (d) => d.status !== 'online' && d.is_online !== true
      )
    }

    return result
  }, [devices, query, statusFilter])

  const totalOnline = devices.filter(
    (d) => d.status === 'online' || d.is_online === true
  ).length

  const totalOffline = devices.length - totalOnline

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 shadow-sm">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Devices Map</h1>
        <p className="text-sm text-slate-500">
          Rechercher et localiser les screens sur la carte
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Devices</p>
          <p className="mt-2 text-3xl font-bold">{devices.length}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Online</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{totalOnline}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Offline</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{totalOffline}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <input
                type="text"
                placeholder="Rechercher par nom ou localisation"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-none"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'online' | 'offline')
                }
                className="w-full rounded-xl border px-4 py-3 outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          <DevicesMap devices={filtered} focusedId={focusedId} />
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Liste des screens</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {filtered.length} résultat(s)
            </span>
          </div>

          <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                Aucun screen trouvé.
              </div>
            ) : (
              filtered.map((device) => {
                const isOnline = device.status === 'online' || device.is_online === true
                const isFocused = focusedId === device.id

                return (
                  <Link
                    key={device.id}
                    href={`/devices/${device.id}`}
                    className={`block rounded-xl border p-4 transition hover:bg-slate-50 ${
                      isFocused ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{device.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {device.location || 'Sans localisation'}
                        </div>

                        {device.latitude != null && device.longitude != null && (
                          <div className="mt-2 text-xs text-slate-400">
                            {device.latitude.toFixed(5)}, {device.longitude.toFixed(5)}
                          </div>
                        )}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isOnline
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}