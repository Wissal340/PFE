'use client'

import { useEffect } from 'react'

type ToastItem = {
  id: string
  message: string
  deviceId?: string
  deviceName?: string
  deviceLocation?: string | null
}

type LiveToastProps = {
  toasts: ToastItem[]
  onClose: (id: string) => void
  onClick: (deviceId?: string) => void
}

export default function LiveToast({
  toasts,
  onClose,
  onClick,
}: LiveToastProps) {
  useEffect(() => {
    if (toasts.length > 0) {
      const audio = new Audio('/alarm.mp3')
      audio.volume = 1
      audio.play().catch(() => {})
    }
  }, [toasts.length])

  if (!toasts.length) return null

  return (
    <div className="fixed right-6 top-6 z-[9999] flex w-full max-w-lg flex-col gap-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-[pulse_.6s_ease] rounded-3xl border-2 border-red-300 bg-red-50 p-5 shadow-2xl"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚨</div>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onClick(toast.deviceId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onClick(toast.deviceId)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <div className="text-xl font-bold text-red-700">
                    ALERTE CRITIQUE
                  </div>

                  <div className="mt-2 text-base text-red-600">
                    {toast.message}
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow">
                    <div className="text-base font-semibold text-slate-900">
                      {toast.deviceName || 'Unknown screen'}
                    </div>
                    <div className="mt-1 text-slate-500">
                      {toast.deviceLocation || 'Sans localisation'}
                    </div>
                  </div>

                  <div className="mt-3 text-sm font-medium text-blue-600">
                    👉 Cliquez pour voir le device
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onClose(toast.id)}
                  className="ml-3 text-xl text-red-400 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}