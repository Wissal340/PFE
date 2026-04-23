'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getViewerDevices } from '@/lib/api'

type Device = {
  id: string
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: string
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

export default function ViewerScreensPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function loadDevices() {
    try {
      setError('')
      const data = await getViewerDevices()
      setDevices(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Impossible de charger les screens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  const filteredDevices = useMemo(() => {
    if (!query.trim()) return devices
    const q = query.toLowerCase()
    return devices.filter((device) =>
      `${device.name} ${device.location ?? ''}`.toLowerCase().includes(q)
    )
  }, [devices, query])

  const onlineCount = useMemo(
    () => devices.filter((d) => d.status === 'online').length,
    [devices]
  )

  const offlineCount = devices.length - onlineCount

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 md:px-6">
        <div className="mx-auto max-w-[1600px] rounded-3xl border border-slate-800 bg-[#111827] p-6 shadow-xl">
          Chargement des screens...
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
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                  <span className="text-lg font-bold text-blue-300">V</span>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-50">
                    Viewer Screens
                  </div>
                  <div className="text-xs text-slate-400">
                    Visualisation des écrans autorisés
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Viewer access
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Mes Screens
                  </h1>

                  <p className="mt-3 max-w-2xl text-base text-slate-300">
                    Consulte les écrans autorisés par l’administrateur et ouvre
                    directement la simulation réelle.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-blue-300">
                      Screens autorisés
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {devices.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Online
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {onlineCount}
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
            <StatCard label="Total Screens" value={devices.length} />
            <StatCard label="Online" value={onlineCount} valueClassName="text-green-400" />
            <StatCard label="Offline" value={offlineCount} valueClassName="text-red-400" />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <input
              type="text"
              placeholder="Rechercher par nom ou localisation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredDevices.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                Aucun screen autorisé.
              </div>
            ) : (
              filteredDevices.map((device) => {
                const isOnline = device.status === 'online'

                return (
                  <div
                    key={device.id}
                    className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-white">
                          {device.name}
                        </h2>
                        <p className="mt-2 text-sm text-slate-400">
                          {device.location || 'Sans localisation'}
                        </p>
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

                    <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300">
                      <div>
                        <span className="font-medium text-slate-400">Latitude :</span>{' '}
                        {device.latitude ?? '-'}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium text-slate-400">Longitude :</span>{' '}
                        {device.longitude ?? '-'}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/devices/${device.id}/player`}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700"
                      >
                        Ouvrir simulation
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}