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
} from 'lucide-react'
import { clearToken, createWebSocket, getMe, getToken } from '@/lib/api'
import LiveToast from './live-toast'

type ToastItem = {
  id: string
  message: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
}

type CurrentUser = {
  id: number
  full_name: string
  email: string
  role: 'admin' | 'technicien' | 'viewer'
  is_active: boolean
  is_approved: boolean
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

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
        const payload = message.payload
        const toastId = `${payload.id}-${Date.now()}`

        setToasts((prev) => [
          {
            id: toastId,
            message: payload.message,
            deviceId: payload.device_id,
            deviceName: payload.device_name || 'Screen',
            deviceLocation: payload.device_location || 'Sans localisation',
          },
          ...prev,
        ])

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId))
        }, 7000)
      }
    })

    return () => socket.close()
  }, [hasToken])

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
  }

  function handleToastClick(deviceId?: string) {
    if (!deviceId) return
    router.push(`/devices/${deviceId}`)
  }

  return (
    <div className="flex min-h-screen bg-[#0b1020] text-slate-100">
      <LiveToast
        toasts={toasts}
        onClose={removeToast}
        onClick={handleToastClick}
      />

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