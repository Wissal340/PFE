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

function StatCard({
  label,
  value,
  valueClassName = 'text-white',
}: {
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </p>
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70" />
    </div>
  )
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
    return (
      <div className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-[1600px] rounded-3xl border border-slate-800 bg-[#111827] p-6 shadow-xl">
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                    <span className="text-lg font-bold text-blue-300">M</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-50">
                      Devices Map
                    </div>
                    <div className="text-xs text-slate-400">
                      Localisation et supervision géographique
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/devices"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Retour devices
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Geolocation dashboard
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Devices Map
                  </h1>

                  <p className="mt-3 max-w-2xl text-base text-slate-300">
                    Rechercher, filtrer et localiser les écrans directement sur
                    la carte interactive.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
                      Total: {devices.length}
                    </span>
                    <span className="rounded-full border border-green-500/30 bg-green-500/15 px-4 py-2 text-sm font-medium text-green-300">
                      Online: {totalOnline}
                    </span>
                    <span className="rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300">
                      Offline: {totalOffline}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-blue-300">
                      Statut live
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {totalOnline > 0 ? 'Actif' : 'Inactif'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Résultats filtrés
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {filtered.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 shadow-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Devices" value={devices.length} />
            <StatCard
              label="Online"
              value={totalOnline}
              valueClassName="text-green-400"
            />
            <StatCard
              label="Offline"
              value={totalOffline}
              valueClassName="text-red-400"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou localisation"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value as 'all' | 'online' | 'offline'
                      )
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none focus:border-blue-500/50"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111827]/95 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                <div className="overflow-hidden rounded-2xl border border-slate-700">
                  <DevicesMap devices={filtered} focusedId={focusedId} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-50">
                  Liste des screens
                </h2>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                  {filtered.length} résultat(s)
                </span>
              </div>

              <div className="max-h-[700px] space-y-3 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucun screen trouvé.
                  </div>
                ) : (
                  filtered.map((device) => {
                    const isOnline =
                      device.status === 'online' || device.is_online === true
                    const isFocused = focusedId === device.id

                    return (
                      <Link
                        key={device.id}
                        href={`/devices/${device.id}`}
                        className={`block rounded-2xl border p-4 transition ${
                          isFocused
                            ? 'border-blue-500/40 bg-blue-500/10'
                            : 'border-slate-800 bg-[#0f172a] hover:border-blue-500/30 hover:bg-[#101a31]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-100">
                              {device.name}
                            </div>
                            <div className="mt-1 text-sm text-slate-400">
                              {device.location || 'Sans localisation'}
                            </div>

                            {device.latitude != null &&
                              device.longitude != null && (
                                <div className="mt-2 text-xs text-slate-500">
                                  {device.latitude.toFixed(5)},{' '}
                                  {device.longitude.toFixed(5)}
                                </div>
                              )}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              isOnline
                                ? 'border border-green-500/30 bg-green-500/15 text-green-300'
                                : 'border border-red-500/30 bg-red-500/15 text-red-300'
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
      </div>
    </div>
  )
}