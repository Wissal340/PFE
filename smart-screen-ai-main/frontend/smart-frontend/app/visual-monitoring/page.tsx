'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getAllCaptures } from '@/lib/api'

type CaptureItem = {
  id: number
  device_id: string
  device_name: string
  device_location?: string | null
  image_url: string
  visual_status: string
  visual_reason?: string | null
  compliance_status: string
  compliance_reason?: string | null
  similarity_score?: number | null
  expected_media_type?: string | null
  expected_media_title?: string | null
  expected_media_url?: string | null
  created_at: string
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
    <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/40">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </p>
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70" />
    </div>
  )
}

function getVisualBadgeClass(status: string) {
  if (status === 'black_screen') return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (status === 'frozen') return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  if (status === 'display_error') return 'border-violet-500/30 bg-violet-500/15 text-violet-300'
  return 'border-green-500/30 bg-green-500/15 text-green-300'
}

function getComplianceBadgeClass(status: string) {
  if (status === 'non_compliant') return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (status === 'partially_compliant') return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  return 'border-green-500/30 bg-green-500/15 text-green-300'
}

export default function VisualMonitoringPage() {
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'visual_issue' | 'compliance_issue' | 'healthy'>('all')

  async function loadData() {
    try {
      setError('')
      const data = await getAllCaptures(60)
      setCaptures(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Impossible de charger la supervision visuelle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredCaptures = useMemo(() => {
    let result = captures

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter((item) =>
        `${item.device_name} ${item.device_location ?? ''} ${item.visual_status} ${item.compliance_status}`
          .toLowerCase()
          .includes(q)
      )
    }

    if (filter === 'visual_issue') {
      result = result.filter((item) => item.visual_status !== 'normal')
    }

    if (filter === 'compliance_issue') {
      result = result.filter((item) => item.compliance_status === 'non_compliant')
    }

    if (filter === 'healthy') {
      result = result.filter(
        (item) =>
          item.visual_status === 'normal' &&
          item.compliance_status === 'compliant'
      )
    }

    return result
  }, [captures, query, filter])

  const visualIssues = captures.filter((c) => c.visual_status !== 'normal').length
  const complianceIssues = captures.filter((c) => c.compliance_status === 'non_compliant').length
  const blackScreens = captures.filter((c) => c.visual_status === 'black_screen').length
  const frozenScreens = captures.filter((c) => c.visual_status === 'frozen').length

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
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                  <span className="text-lg font-bold text-blue-300">V</span>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-50">
                    Visual Monitoring
                  </div>
                  <div className="text-xs text-slate-400">
                    Supervision visuelle globale
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Global control
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Captures & conformité
                  </h1>
                  <p className="mt-3 max-w-2xl text-base text-slate-300">
                    Visualise les dernières captures de tous les screens et détecte
                    rapidement les écrans noirs, les diffusions figées et les non-conformités.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/devices"
                    className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    Devices
                  </Link>
                  <Link
                    href="/alerts"
                    className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    Alertes
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 shadow-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Captures total" value={captures.length} />
            <StatCard label="Visual issues" value={visualIssues} valueClassName="text-fuchsia-300" />
            <StatCard label="Compliance issues" value={complianceIssues} valueClassName="text-amber-300" />
            <StatCard label="Black / Frozen" value={`${blackScreens} / ${frozenScreens}`} valueClassName="text-red-300" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
            <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <input
                type="text"
                placeholder="Rechercher par screen, localisation ou statut"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
              />
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-slate-100 outline-none"
              >
                <option value="all">Tous</option>
                <option value="visual_issue">Anomalies visuelles</option>
                <option value="compliance_issue">Non conformité</option>
                <option value="healthy">Sains</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredCaptures.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                Aucune capture trouvée.
              </div>
            ) : (
              filteredCaptures.map((capture) => (
                <div
                  key={capture.id}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111827]/95 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]"
                >
                  <Link href={`/captures/${capture.id}`}>
                    <div className="aspect-video cursor-pointer bg-black">
                      <img
                        src={capture.image_url}
                        alt={capture.device_name}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </div>
                  </Link>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {capture.device_name}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {capture.device_location || 'Sans localisation'}
                        </div>
                      </div>

                      <Link
                        href={`/devices/${capture.device_id}`}
                        className="rounded-xl border border-slate-700 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Device
                      </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getVisualBadgeClass(
                          capture.visual_status
                        )}`}
                      >
                        {capture.visual_status}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getComplianceBadgeClass(
                          capture.compliance_status
                        )}`}
                      >
                        {capture.compliance_status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-400">Visual:</span>{' '}
                        {capture.visual_reason || '-'}
                      </div>

                      <div>
                        <span className="text-slate-400">Compliance:</span>{' '}
                        {capture.compliance_reason || '-'}
                      </div>

                      <div>
                        <span className="text-slate-400">Similarity:</span>{' '}
                        {capture.similarity_score != null
                          ? Number(capture.similarity_score).toFixed(2)
                          : '-'}
                      </div>

                      <div>
                        <span className="text-slate-400">Expected:</span>{' '}
                        {capture.expected_media_title || 'Sans titre'}
                        {capture.expected_media_type
                          ? ` (${capture.expected_media_type})`
                          : ''}
                      </div>

                      <div className="pt-2 text-xs text-slate-500">
                        {new Date(capture.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2">
                      <Link
                        href={`/captures/${capture.id}`}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                      >
                        Détail capture
                      </Link>

                      <a
                        href={capture.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        Ouvrir image
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}