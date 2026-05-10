'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Monitor,
  Bell,
  PlusCircle,
  Map,
  LogIn,
  LogOut,
  UserPlus,
  User,
  MonitorPlay,
  Eye,
  AlertTriangle,
  X,
} from 'lucide-react'
import { clearToken, createWebSocket, getMe, getToken } from '@/lib/api'
import LiveToast from './live-toast'

type ToastItem = {
  id: string
  message: string
  type?: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
  createdAt?: string | null
}

type CurrentUser = {
  id: number
  full_name: string
  email: string
  role: 'admin' | 'technicien' | 'viewer'
  is_active: boolean
  is_approved: boolean
}

const CRITICAL_TYPES = ['BLACK_SCREEN', 'FROZEN', 'WRONG_CONTENT', 'VISUAL', 'COMPLIANCE']

function isCriticalAlert(alert: ToastItem) {
  return CRITICAL_TYPES.includes((alert.type || '').toUpperCase())
}

function alertLabel(type?: string) {
  const value = (type || '').toUpperCase()
  if (value === 'BLACK_SCREEN') return 'Écran noir'
  if (value === 'FROZEN') return 'Freeze'
  if (value === 'WRONG_CONTENT') return 'Contenu non programmé'
  if (value === 'CPU') return 'CPU élevé'
  if (value === 'TEMP') return 'Température élevée'
  if (value === 'VLC') return 'Player arrêté'
  if (value === 'NORMAL') return 'Retour normal'
  return value || 'Alerte'
}

function alertStyle(type?: string) {
  const value = (type || '').toUpperCase()

  if (value === 'NORMAL') {
    return {
      card: 'border-green-400/40 bg-green-950/95 hover:border-green-300/70',
      icon: 'text-green-300',
      label: 'text-green-300',
      title: 'text-green-50',
      subtitle: 'text-green-100/80',
      badge: 'bg-green-500/15 text-green-200 border-green-400/30',
      labelText: 'Retour à l’état normal',
    }
  }

  return {
    card: 'border-orange-400/30 bg-[#111827]/95 hover:border-orange-300/60',
    icon: 'text-orange-300',
    label: 'text-orange-300',
    title: 'text-white',
    subtitle: 'text-slate-300',
    badge: 'bg-orange-500/15 text-orange-200 border-orange-400/30',
    labelText: 'Notification',
  }
}


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isPlayerPage = pathname?.includes('/player') ?? false

  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [criticalAlert, setCriticalAlert] = useState<ToastItem | null>(null)
  const [normalAlerts, setNormalAlerts] = useState<ToastItem[]>([])

  useEffect(() => {
    setMounted(true)
    setHasToken(!!getToken())
  }, [])

  useEffect(() => {
    async function syncAuth() {
      const token = getToken()
      setHasToken(!!token)

      if (!token) {
        setCurrentUser(null)
        return
      }

      try {
        const me = (await getMe()) as CurrentUser
        setCurrentUser(me)
      } catch (error) {
        console.error(error)
        setCurrentUser(null)
      }
    }

    syncAuth()
    window.addEventListener('storage', syncAuth)
    window.addEventListener('focus', syncAuth)

    return () => {
      window.removeEventListener('storage', syncAuth)
      window.removeEventListener('focus', syncAuth)
    }
  }, [pathname])

  useEffect(() => {
    if (!mounted) return

    const token = getToken()

    if (!token && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login')
      return
    }

    if (!currentUser) return

    if (currentUser.role === 'viewer') {
      if (
        pathname === '/' ||
        pathname === '/devices' ||
        pathname === '/devices/map' ||
        pathname === '/alerts' ||
        pathname === '/register' ||
        pathname === '/admin/users' ||
        pathname === '/visual-monitoring'
      ) {
        router.push('/viewer/screens')
      }
    } else {
      if (pathname === '/viewer/screens' && currentUser.role !== 'viewer') {
        router.push('/')
      }
    }
  }, [mounted, pathname, router, currentUser])

  useEffect(() => {
    if (!hasToken) return

    const socket = createWebSocket((message) => {
      if (message?.type === 'alert_created') {
        const payload = message.payload || {}
        const alertItem: ToastItem = {
          id: `${payload.id}-${Date.now()}`,
          message: payload.message || 'Nouvelle alerte détectée',
          type: payload.type,
          deviceId: payload.device_id,
          deviceName: payload.device_name || 'Screen',
          deviceLocation: payload.device_location || 'Sans localisation',
          createdAt: payload.created_at || null,
        }

        if (isPlayerPage) {
          return
        }

        if (isCriticalAlert(alertItem)) {
          setCriticalAlert(alertItem)
        } else {
          setNormalAlerts((prev) => [alertItem, ...prev].slice(0, 4))
          setToasts((prev) => [alertItem, ...prev])

          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== alertItem.id))
            setNormalAlerts((prev) => prev.filter((t) => t.id !== alertItem.id))
          }, 8000)
        }
      }
    })

    return () => socket.close()
  }, [hasToken, isPlayerPage])

  const navItems = useMemo(() => {
    if (!currentUser) return []

    if (currentUser.role === 'admin') {
      return [
        { href: '/', label: 'Overview', icon: LayoutDashboard },
        { href: '/devices', label: 'Devices', icon: Monitor },
        { href: '/devices/map', label: 'Map', icon: Map },
        { href: '/alerts', label: 'Alerts', icon: Bell },
        { href: '/visual-monitoring', label: 'Visual Monitoring', icon: Eye },
        { href: '/register', label: 'Register', icon: PlusCircle },
        { href: '/admin/users', label: 'Users', icon: User },
        { href: '/viewer/screens', label: 'My Screens', icon: MonitorPlay },
      ]
    }

    if (currentUser.role === 'technicien') {
      return [
        { href: '/', label: 'Overview', icon: LayoutDashboard },
        { href: '/devices', label: 'Devices', icon: Monitor },
        { href: '/devices/map', label: 'Map', icon: Map },
        { href: '/alerts', label: 'Alerts', icon: Bell },
        { href: '/visual-monitoring', label: 'Visual Monitoring', icon: Eye },
        { href: '/register', label: 'Register', icon: PlusCircle },
      ]
    }

    return [{ href: '/viewer/screens', label: 'My Screens', icon: MonitorPlay }]
  }, [currentUser])

  function handleLogout() {
    clearToken()
    setHasToken(false)
    setCurrentUser(null)
    router.push('/login')
    router.refresh()
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    setNormalAlerts((prev) => prev.filter((toast) => toast.id !== id))
  }

  function handleToastClick(deviceId?: string) {
    if (!deviceId) return
    router.push(`/devices/${deviceId}`)
  }

  return (
    <div className="flex min-h-screen bg-[#0b1020] text-slate-100">
      {!isPlayerPage && (
        <LiveToast
          toasts={toasts}
          onClose={removeToast}
          onClick={handleToastClick}
        />
      )}

      {!isPlayerPage && criticalAlert && (
        <div className="fixed left-1/2 top-5 z-[999] w-[min(92vw,620px)] -translate-x-1/2 rounded-[28px] border border-red-500/40 bg-red-950/95 p-6 text-white shadow-[0_25px_90px_rgba(220,38,38,0.45)] backdrop-blur-xl">
          <button
            onClick={() => setCriticalAlert(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-red-100 hover:bg-white/20"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 ring-1 ring-red-300/40">
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>

            <div className="pr-8">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300">
                Critical alert détectée par IA
              </div>

              <h2 className="mt-2 text-2xl font-black text-white">
                {alertLabel(criticalAlert.type)} — {criticalAlert.deviceName}
              </h2>

              <p className="mt-2 text-sm text-red-100">
                {criticalAlert.message}
              </p>

              <p className="mt-1 text-xs text-red-200/80">
                Localisation : {criticalAlert.deviceLocation || 'Sans localisation'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => handleToastClick(criticalAlert.deviceId)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Ouvrir le device
                </button>

                <Link
                  href="/alerts"
                  className="rounded-xl border border-red-300/30 bg-white/10 px-4 py-2 text-sm font-semibold text-red-50 hover:bg-white/15"
                >
                  Voir toutes les alertes
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isPlayerPage && normalAlerts.length > 0 && (
        <div className="fixed right-5 top-5 z-[998] flex w-[360px] flex-col gap-3">
          {normalAlerts.map((alert) => {
            const style = alertStyle(alert.type)

            return (
              <button
                key={alert.id}
                onClick={() => handleToastClick(alert.deviceId)}
                className={`rounded-2xl border p-4 text-left shadow-2xl backdrop-blur transition ${style.card}`}
              >
                <div className="flex items-start gap-3">
                  <Bell className={`mt-0.5 h-5 w-5 ${style.icon}`} />

                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${style.label}`}>
                      {style.labelText}
                    </div>

                    <div className={`mt-1 text-sm font-semibold ${style.title}`}>
                      {alertLabel(alert.type)} — {alert.deviceName}
                    </div>

                    <div className={`mt-1 text-xs ${style.subtitle}`}>
                      {alert.message}
                    </div>

                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${style.badge}`}>
                      Cliquer pour ouvrir le device
                    </div>
                  </div>

                  <span
                    onClick={(event) => {
                      event.stopPropagation()
                      removeToast(alert.id)
                    }}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                  >
                    ×
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <aside className="flex min-h-screen w-64 flex-col border-r border-slate-800 bg-[#0f172a] p-5">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-400/30">
              <span className="font-bold text-blue-300">S</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Smart Screen</div>
              <div className="text-xs text-slate-400">AI Dashboard</div>
            </div>
          </div>

          <nav className="space-y-2">
            {mounted && hasToken && currentUser && navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-[#111827] hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}

            {mounted && !hasToken && (
              <>
                <Link
                  href="/login"
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                    pathname === '/login'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-[#111827]'
                  }`}
                >
                  <LogIn size={18} />
                  Login
                </Link>

                <Link
                  href="/signup"
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                    pathname === '/signup'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-[#111827]'
                  }`}
                >
                  <UserPlus size={18} />
                  Signup
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto pt-6">
          {mounted && hasToken && (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut size={18} />
              Logout
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 bg-[#0b1020] p-6">{children}</main>
    </div>
  )
}
