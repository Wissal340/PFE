'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createWebSocket,
  getAiDashboardHistory,
  getAlerts,
  getAllCaptures,
  getDevices,
  getToken,
} from '../lib/api'
import LiveToast from '../components/live-toast'

type Device = {
  id: string
  name: string
  location?: string | null
  status?: string
}

type Alert = {
  id: number
  message: string
  type: string
  created_at: string
  device_id?: string
  value?: number | null
  threshold?: number | null
}

type AiHistoryItem = {
  id: number
  device_id: string
  device_name: string
  device_location?: string | null
  cpu: number
  ram: number
  temp: number
  vlc_running: boolean
  anomaly_score: number
  prediction: 'normal' | 'warning' | 'critical' | 'unknown'
  reason: string
  created_at: string
}

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

type ToastItem = {
  id: string
  message: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
}

function StatCard({
  label,
  value,
  subValue,
  valueClassName = 'text-slate-50',
}: {
  label: string
  value: string | number
  subValue?: string
  valueClassName?: string
}) {
  return (
    <div className="group rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)]">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${valueClassName}`}>
        {value}
      </p>
      {subValue && <p className="mt-2 text-xs text-slate-500">{subValue}</p>}
      <div className="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 opacity-70 transition group-hover:w-24" />
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827]/95 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function getAlertBadge(type: string) {
  if (type === 'CPU') return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  if (type === 'TEMP') return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (type === 'VLC') return 'border-violet-500/30 bg-violet-500/15 text-violet-300'
  if (type === 'AI') return 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
  if (type === 'VISUAL') return 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300'
  if (type === 'COMPLIANCE') return 'border-amber-500/30 bg-amber-500/15 text-amber-300'
  return 'border-slate-600 bg-slate-700/40 text-slate-300'
}

function getPredictionBadge(prediction: string) {
  if (prediction === 'critical') return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (prediction === 'warning') return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  if (prediction === 'normal') return 'border-green-500/30 bg-green-500/15 text-green-300'
  return 'border-slate-600 bg-slate-700/40 text-slate-300'
}

function getAiBadgeClass(status: 'normal' | 'warning' | 'critical') {
  if (status === 'critical') return 'border-red-500/30 bg-red-500/15 text-red-300'
  if (status === 'warning') return 'border-orange-500/30 bg-orange-500/15 text-orange-300'
  return 'border-green-500/30 bg-green-500/15 text-green-300'
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

function getAiSummary(aiHistory: AiHistoryItem[]) {
  const latest = aiHistory[0]

  if (!latest) {
    return {
      status: 'normal' as const,
      score: 0,
      reason: 'Aucune prédiction AI disponible',
      criticalCount: 0,
      warningCount: 0,
      aiCount: 0,
    }
  }

  const criticalCount = aiHistory.filter((item) => item.prediction === 'critical').length
  const warningCount = aiHistory.filter((item) => item.prediction === 'warning').length

  const status =
    latest.prediction === 'critical'
      ? 'critical'
      : latest.prediction === 'warning'
      ? 'warning'
      : 'normal'

  return {
    status,
    score: Number(latest.anomaly_score ?? 0),
    reason: latest.reason,
    criticalCount,
    warningCount,
    aiCount: aiHistory.length,
  }
}

export default function HomePage() {
  const router = useRouter()

  const [hasToken, setHasToken] = useState(false)
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<Device[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([])
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [showAllAi, setShowAllAi] = useState(false)
  const [showAllCaptures, setShowAllCaptures] = useState(false)

  async function loadDashboard(authenticated?: boolean) {
    const isAuthenticated =
      authenticated !== undefined ? authenticated : !!getToken()

    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      setError('')

      const [devicesData, alertsData, aiData, capturesData] = await Promise.all([
        getDevices(),
        getAlerts(),
        getAiDashboardHistory(50),
        getAllCaptures(30),
      ])

      setDevices(Array.isArray(devicesData) ? devicesData : [])
      setAlerts(Array.isArray(alertsData) ? alertsData : [])
      setAiHistory(Array.isArray(aiData) ? aiData : [])
      setCaptures(Array.isArray(capturesData) ? capturesData : [])
    } catch (err) {
      console.error(err)
      setError('Impossible de charger les données du dashboard')
    } finally {
      setLoading(false)
    }
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  function handleToastClick(deviceId?: string) {
    if (!deviceId) return
    router.push(`/devices/${deviceId}`)
  }

  useEffect(() => {
    const token = getToken()
    const authenticated = !!token
    setHasToken(authenticated)

    loadDashboard(authenticated)

    if (!authenticated) return

    const socket = createWebSocket((message) => {
      if (message?.type === 'alert_created') {
        const payload = message.payload
        const matchedDevice = devices.find((d) => d.id === payload.device_id)
        const toastId = `${payload.id}-${Date.now()}`

        setToasts((prev) => [
          {
            id: toastId,
            message: payload.message,
            deviceId: payload.device_id,
            deviceName: matchedDevice?.name || payload.device_name || 'Screen',
            deviceLocation:
              matchedDevice?.location ||
              payload.device_location ||
              'Sans localisation',
          },
          ...prev,
        ])

        setTimeout(() => removeToast(toastId), 5000)
        loadDashboard(true)
      }

      if (message?.type === 'metric_created') {
        loadDashboard(true)
      }
    })

    return () => {
      socket.close()
    }
  }, [devices])

  const onlineDevices = useMemo(
    () => devices.filter((d) => d.status === 'online').length,
    [devices]
  )

  const offlineDevices = useMemo(
    () => devices.filter((d) => d.status !== 'online').length,
    [devices]
  )

  const aiSummary = useMemo(() => getAiSummary(aiHistory), [aiHistory])

  const visualAlerts = useMemo(
    () => alerts.filter((a) => a.type === 'VISUAL'),
    [alerts]
  )

  const complianceAlerts = useMemo(
    () => alerts.filter((a) => a.type === 'COMPLIANCE'),
    [alerts]
  )

  const blackScreens = useMemo(
    () => captures.filter((c) => c.visual_status === 'black_screen').length,
    [captures]
  )

  const frozenScreens = useMemo(
    () => captures.filter((c) => c.visual_status === 'frozen').length,
    [captures]
  )

  const healthyCaptures = useMemo(
    () =>
      captures.filter(
        (c) =>
          c.visual_status === 'normal' && c.compliance_status === 'compliant'
      ).length,
    [captures]
  )

  const recentAlerts = showAllAlerts ? alerts : alerts.slice(0, 6)
  const visibleAi = showAllAi ? aiHistory : aiHistory.slice(0, 6)
  const visibleCaptures = showAllCaptures ? captures : captures.slice(0, 6)

  const topCriticalDevices = useMemo(() => {
    const criticalItems = aiHistory
      .filter((item) => item.prediction === 'critical')
      .sort((a, b) => b.anomaly_score - a.anomaly_score)

    const seen = new Set<string>()
    return criticalItems
      .filter((item) => {
        if (seen.has(item.device_id)) return false
        seen.add(item.device_id)
        return true
      })
      .slice(0, 5)
  }, [aiHistory])

  const problematicCaptures = useMemo(
    () =>
      captures.filter(
        (c) =>
          c.visual_status !== 'normal' || c.compliance_status === 'non_compliant'
      ),
    [captures]
  )

  if (!hasToken) {
    return (
      <div className="min-h-screen bg-[#0b1020] text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10 md:px-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                  <span className="text-lg font-bold text-blue-300">S</span>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-50">
                    Smart Screen AI
                  </div>
                  <div className="text-xs text-slate-400">
                    Final Monitoring Dashboard
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-10 md:px-10">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Intelligent monitoring platform
                  </p>

                  <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Supervisez vos écrans avec une vue globale intelligente
                  </h1>

                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                    Une plateforme unifiée pour le monitoring des devices, les
                    anomalies AI, les contrôles visuels, la conformité du contenu
                    diffusé et les alertes temps réel.
                  </p>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                      href="/login"
                      className="rounded-2xl bg-blue-600 px-6 py-3 text-center font-medium text-white transition hover:bg-blue-700"
                    >
                      Login
                    </Link>

                    <Link
                      href="/signup"
                      className="rounded-2xl border border-slate-700 bg-white/5 px-6 py-3 text-center font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      Register
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-[#111827]/90 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                  <h2 className="text-lg font-semibold text-slate-50">
                    Modules principaux
                  </h2>

                  <div className="mt-5 grid gap-3">
                    {[
                      'Monitoring global des screens',
                      'Analyse AI des métriques',
                      'Détection visuelle automatique',
                      'Vérification de conformité',
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] px-6 py-8 text-slate-100">
        <div className="rounded-3xl border border-slate-800 bg-[#111827] p-6 shadow-xl">
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <LiveToast
        toasts={toasts}
        onClose={removeToast}
        onClick={handleToastClick}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-blue-900/30 bg-gradient-to-r from-[#0f172a] via-[#111c44] to-[#0b1020] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 ring-1 ring-blue-400/30">
                    <span className="text-lg font-bold text-blue-300">S</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-50">
                      Smart Screen AI
                    </div>
                    <div className="text-xs text-slate-400">
                      Final Dashboard
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/devices"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Devices
                  </Link>
                  <Link
                    href="/visual-monitoring"
                    className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    Visual Monitoring
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

            <div className="px-6 py-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Unified command center
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Supervision intelligente globale
                  </h1>

                  <p className="mt-3 max-w-2xl text-base text-slate-300">
                    Une seule vue pour suivre les écrans actifs, les anomalies
                    AI, les problèmes visuels, les non-conformités de diffusion
                    et les dernières captures remontées par les devices.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[500px]">
                  <div
                    className={`rounded-2xl border p-4 ${getAiBadgeClass(
                      aiSummary.status
                    )}`}
                  >
                    <div className="text-xs uppercase tracking-wide">
                      AI Status global
                    </div>
                    <div className="mt-2 text-2xl font-semibold capitalize text-white">
                      {aiSummary.status}
                    </div>
                    <div className="mt-1 text-xs text-slate-200/80">
                      Score: {aiSummary.score.toFixed(2)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Captures saines
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {healthyCaptures}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Visual + compliance OK
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
            <StatCard label="Total Screens" value={devices.length} subValue="Devices enregistrés" />
            <StatCard label="Online" value={onlineDevices} subValue="Screens actifs" valueClassName="text-green-400" />
            <StatCard label="Offline" value={offlineDevices} subValue="Screens inactifs" valueClassName="text-red-400" />
            <StatCard label="AI Critical" value={aiSummary.criticalCount} subValue="Alertes critiques AI" valueClassName="text-cyan-400" />
            <StatCard label="AI Warning" value={aiSummary.warningCount} subValue="AI warning" valueClassName="text-orange-300" />
            <StatCard label="Visual Alerts" value={visualAlerts.length} subValue="Anomalies visuelles" valueClassName="text-fuchsia-300" />
            <StatCard label="Compliance" value={complianceAlerts.length} subValue="Non conformités" valueClassName="text-amber-300" />
            <StatCard label="Black / Frozen" value={`${blackScreens} / ${frozenScreens}`} subValue="Écrans noirs / figés" valueClassName="text-red-300" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              title="Résumé AI"
              subtitle="Dernière analyse intelligente détectée"
              right={
                <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAiBadgeClass(aiSummary.status)}`}>
                  {aiSummary.status}
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
                  <div className="text-sm text-slate-400">Score global</div>
                  <div className="mt-2 text-3xl font-bold text-white">
                    {aiSummary.score.toFixed(2)}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
                  <div className="text-sm text-slate-400">État</div>
                  <div className="mt-2 text-3xl font-bold capitalize text-white">
                    {aiSummary.status}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
                  <div className="text-sm text-slate-400">Historique AI</div>
                  <div className="mt-2 text-3xl font-bold text-white">
                    {aiSummary.aiCount}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
                <div className="text-sm text-slate-400">Reason</div>
                <div className="mt-2 text-sm text-slate-200">
                  {aiSummary.reason}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Screens les plus critiques"
              subtitle="Devices avec les scores AI les plus élevés"
            >
              <div className="space-y-3">
                {topCriticalDevices.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucun screen critique pour le moment.
                  </div>
                ) : (
                  topCriticalDevices.map((item) => (
                    <div
                      key={item.device_id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-red-500/30 hover:bg-[#101a31]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-100">
                            {item.device_name}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {item.device_location || 'Sans localisation'}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                            critical
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            Score: {Number(item.anomaly_score).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-200">
                        {item.reason}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard
              title="Historique AI récent"
              subtitle="Dernières analyses intelligentes"
            >
              <div className="space-y-3">
                {visibleAi.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucun historique AI.
                  </div>
                ) : (
                  <>
                    {visibleAi.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-cyan-500/30 hover:bg-[#101a31]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getPredictionBadge(item.prediction)}`}>
                              {item.prediction}
                            </span>
                            <span className="text-xs text-slate-400">
                              Score: {Number(item.anomaly_score).toFixed(2)}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-3 text-sm font-medium text-slate-100">
                          {item.device_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.device_location || 'Sans localisation'}
                        </div>
                        <div className="mt-3 text-sm text-slate-200">
                          {item.reason}
                        </div>
                      </div>
                    ))}

                    {aiHistory.length > 6 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAllAi((prev) => !prev)}
                          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {showAllAi ? 'Afficher moins' : 'Afficher plus'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Alertes visuelles récentes"
              subtitle="Écran noir, figé, erreurs d’affichage"
            >
              <div className="space-y-3">
                {visualAlerts.slice(0, 6).length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucune alerte visuelle.
                  </div>
                ) : (
                  visualAlerts.slice(0, 6).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-fuchsia-500/30 hover:bg-[#101a31]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-300">
                          VISUAL
                        </span>
                        <div className="text-xs text-slate-500">
                          {new Date(alert.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-200">
                        {alert.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Alertes conformité récentes"
              subtitle="Contrôle du contenu réellement diffusé"
            >
              <div className="space-y-3">
                {complianceAlerts.slice(0, 6).length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucune alerte de conformité.
                  </div>
                ) : (
                  complianceAlerts.slice(0, 6).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-amber-500/30 hover:bg-[#101a31]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                          COMPLIANCE
                        </span>
                        <div className="text-xs text-slate-500">
                          {new Date(alert.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-200">
                        {alert.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Dernières captures problématiques"
              subtitle="Screens avec anomalie visuelle ou non conformité"
              right={
                <span className="rounded-full border border-slate-700 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {problematicCaptures.length} capture(s)
                </span>
              }
            >
              {problematicCaptures.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                  Aucune capture problématique détectée.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {problematicCaptures.slice(0, 4).map((capture) => (
                    <div
                      key={capture.id}
                      className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0f172a] transition hover:border-blue-500/30 hover:bg-[#101a31]"
                    >
                      <div className="aspect-video bg-black">
                        <img
                          src={capture.image_url}
                          alt={capture.device_name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-100">
                              {capture.device_name}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {capture.device_location || 'Sans localisation'}
                            </div>
                          </div>

                          <Link
                            href={`/devices/${capture.device_id}`}
                            className="rounded-xl border border-slate-700 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            Ouvrir
                          </Link>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
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

                        <div className="mt-3 text-sm text-slate-300">
                          {capture.compliance_reason || capture.visual_reason || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Dernières captures"
              subtitle="Aperçu global des dernières remontées"
            >
              <div className="space-y-3">
                {visibleCaptures.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucune capture disponible.
                  </div>
                ) : (
                  <>
                    {visibleCaptures.map((capture) => (
                      <div
                        key={capture.id}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                      >
                        <div className="flex items-start gap-4">
                          <img
                            src={capture.image_url}
                            alt={capture.device_name}
                            className="h-20 w-32 rounded-xl object-cover bg-black"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-100">
                                  {capture.device_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {capture.device_location || 'Sans localisation'}
                                </div>
                              </div>

                              <div className="text-xs text-slate-500">
                                {new Date(capture.created_at).toLocaleString()}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
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
                          </div>
                        </div>
                      </div>
                    ))}

                    {captures.length > 6 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAllCaptures((prev) => !prev)}
                          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {showAllCaptures ? 'Afficher moins' : 'Afficher plus'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Dernières alertes"
              subtitle="Vue globale des événements critiques"
            >
              <div className="space-y-3">
                {recentAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 text-sm text-slate-500">
                    Aucune alerte trouvée.
                  </div>
                ) : (
                  <>
                    {recentAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAlertBadge(alert.type)}`}>
                            {alert.type}
                          </span>

                          <div className="text-xs text-slate-500">
                            {new Date(alert.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-slate-200">
                          {alert.message}
                        </div>
                      </div>
                    ))}

                    {alerts.length > 6 && (
                      <div className="pt-2">
                        <button
                          onClick={() => setShowAllAlerts((prev) => !prev)}
                          className="rounded-xl border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          {showAllAlerts ? 'Afficher moins' : 'Afficher plus'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Accès rapides"
              subtitle="Navigation vers les modules principaux"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href="/devices"
                  className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                >
                  <div className="text-lg font-semibold text-white">Devices</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Gérer et superviser les écrans
                  </div>
                </Link>

                <Link
                  href="/alerts"
                  className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                >
                  <div className="text-lg font-semibold text-white">Alerts</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Consulter toutes les alertes
                  </div>
                </Link>

                <Link
                  href="/visual-monitoring"
                  className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                >
                  <div className="text-lg font-semibold text-white">
                    Visual Monitoring
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Contrôler captures et conformité
                  </div>
                </Link>

                <Link
                  href="/devices/map"
                  className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 transition hover:border-blue-500/30 hover:bg-[#101a31]"
                >
                  <div className="text-lg font-semibold text-white">Map</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Visualiser les screens sur la carte
                  </div>
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}