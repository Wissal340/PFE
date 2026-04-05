'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Monitor,
  Bell,
  PlusCircle,
  Map,
  LogIn,
  LogOut,
  UserPlus,
} from 'lucide-react'
import { clearToken, createWebSocket, getToken } from '../lib/api'
import LiveToast from './live-toast'

const protectedNav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/devices', label: 'Devices', icon: Monitor },
  { href: '/devices/map', label: 'Devices Map', icon: Map },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/register', label: 'Register Screen', icon: PlusCircle },
]

type ToastItem = {
  id: string
  message: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    setMounted(true)
    setHasToken(!!getToken())
  }, [])

  useEffect(() => {
    function syncAuth() {
      setHasToken(!!getToken())
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
            deviceName: payload.device_name || 'Unknown screen',
            deviceLocation: payload.device_location || 'Sans localisation',
          },
          ...prev,
        ])

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId))
        }, 7000)
      }
    })

    return () => {
      socket.close()
    }
  }, [hasToken])

  function handleLogout() {
    clearToken()
    setHasToken(false)
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
    <div className="flex min-h-screen bg-slate-100">
      <LiveToast
        toasts={toasts}
        onClose={removeToast}
        onClick={handleToastClick}
      />

      <aside className="w-64 border-r bg-white p-5">
        <div className="mb-8">
          <div className="text-xl font-bold">Smart Screen AI</div>
          <div className="text-xs text-slate-500">Monitoring Dashboard</div>
        </div>

        <nav className="space-y-2">
          {mounted && hasToken && (
            <>
              {protectedNav.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                )
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="mt-6 flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={18} />
                Logout
              </button>
            </>
          )}

          {mounted && !hasToken && (
            <>
              <Link
                href="/login"
                className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition ${
                  pathname === '/login'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LogIn size={18} />
                Login
              </Link>

              <Link
                href="/signup"
                className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition ${
                  pathname === '/signup'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserPlus size={18} />
                Signup
              </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}