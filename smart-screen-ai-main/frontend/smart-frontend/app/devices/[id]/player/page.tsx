'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getDevice, getPlaylist } from '../../../../lib/api'

type Device = {
  id: string
  name: string
  location?: string | null
  status?: string
}

type PlaylistItem = {
  id: number
  playlist_id: number
  title?: string | null
  media_url: string
  media_type: 'image' | 'video'
  duration_seconds: number
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  order_index: number
  is_active: boolean
  created_at: string
}

type Playlist = {
  id: number
  device_id: string
  name: string
  created_at: string
  items: PlaylistItem[]
}

function toMinutes(time?: string | null) {
  if (!time || !time.includes(':')) return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function isDateAllowed(item: PlaylistItem, now: Date) {
  const today = now.toISOString().slice(0, 10)

  if (item.start_date && today < item.start_date) return false
  if (item.end_date && today > item.end_date) return false

  return true
}

function isTimeAllowed(item: PlaylistItem, now: Date) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const start = toMinutes(item.start_time)
  const end = toMinutes(item.end_time)

  if (start === null && end === null) return true
  if (start !== null && end === null) return currentMinutes >= start
  if (start === null && end !== null) return currentMinutes <= end

  if (start === end) return true

  if (start! < end!) {
    return currentMinutes >= start! && currentMinutes <= end!
  }

  return currentMinutes >= start! || currentMinutes <= end!
}

function isPlayable(item: PlaylistItem, now: Date) {
  if (!item.is_active) return false
  if (!isDateAllowed(item, now)) return false
  if (!isTimeAllowed(item, now)) return false
  return true
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`
      }
    }

    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '')
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`
      }
    }

    return null
  } catch {
    return null
  }
}

export default function DevicePlayerPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [device, setDevice] = useState<Device | null>(null)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [debugVisible, setDebugVisible] = useState(true)
  const [showControls, setShowControls] = useState(true)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  async function loadData() {
    if (!id) return

    try {
      const [deviceData, playlistData] = await Promise.all([
        getDevice(id).catch(() => null),
        getPlaylist(id).catch(() => null),
      ])

      setDevice((deviceData as Device | null) || null)
      setPlaylist((playlistData as Playlist | null) || null)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(refreshInterval)
  }, [id])

  const playableItems = useMemo(() => {
    const items = [...(playlist?.items || [])].sort(
      (a, b) => a.order_index - b.order_index
    )

    return items.filter((item) => isPlayable(item, currentTime))
  }, [playlist, currentTime])

  useEffect(() => {
    if (currentIndex >= playableItems.length) {
      setCurrentIndex(0)
    }
  }, [playableItems.length, currentIndex])

  const currentItem =
    playableItems.length > 0 ? playableItems[currentIndex] : null

  function goToNext() {
    if (playableItems.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % playableItems.length)
  }

  function showPlayerControlsTemporarily() {
    setShowControls(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }

  useEffect(() => {
    showPlayerControlsTemporarily()

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [currentIndex])

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!currentItem) return

    if (currentItem.media_type === 'image') {
      const durationMs = Math.max(
        1,
        Number(currentItem.duration_seconds || 15)
      ) * 1000

      timerRef.current = setTimeout(() => {
        goToNext()
      }, durationMs)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [
    currentItem?.id,
    currentItem?.media_type,
    currentItem?.duration_seconds,
    playableItems.length,
  ])

  function handleVideoEnded() {
    goToNext()
  }

  function handleVideoLoadedMetadata() {
    if (!currentItem || currentItem.media_type !== 'video') return

    const video = videoRef.current
    if (!video) return

    const configuredDuration = Number(currentItem.duration_seconds || 0)

    if (
      configuredDuration > 0 &&
      video.duration &&
      configuredDuration < video.duration
    ) {
      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        goToNext()
      }, configuredDuration * 1000)
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'd') {
        setDebugVisible((prev) => !prev)
      }

      if (e.key === 'ArrowRight') {
        goToNext()
      }

      if (e.key === 'Escape') {
        router.push(`/devices/${id}`)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playableItems.length, id, router])

  const youtubeEmbed = currentItem
    ? getYouTubeEmbedUrl(currentItem.media_url)
    : null

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Chargement du player...
      </div>
    )
  }

  return (
    <div
      className="relative min-h-screen bg-black text-white"
      onMouseMove={showPlayerControlsTemporarily}
      onClick={showPlayerControlsTemporarily}
    >
      {showControls && (
        <div className="absolute left-4 top-4 z-50 flex flex-wrap gap-2">
          <button
            onClick={() => router.back()}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
          >
            ← Retour
          </button>

          <Link
            href={`/devices/${id}`}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
          >
            Device
          </Link>

          <button
            onClick={() => router.push('/devices')}
            className="rounded-xl bg-red-500/80 px-4 py-2 text-sm text-white transition hover:bg-red-600"
          >
            Fermer
          </button>
        </div>
      )}

      {!currentItem ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold">Aucune diffusion programmée</h1>
          <p className="mt-3 text-sm text-slate-300">
            Aucun média actif pour l’heure actuelle.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Device: {device?.name || 'Unknown'} •{' '}
            {currentTime.toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <div className="flex min-h-screen items-center justify-center">
          {currentItem.media_type === 'image' ? (
            <img
              src={currentItem.media_url}
              alt={currentItem.title || 'media'}
              className="max-h-screen max-w-full object-contain"
            />
          ) : youtubeEmbed ? (
            <iframe
              src={youtubeEmbed}
              title={currentItem.title || 'video'}
              className="h-screen w-screen"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={currentItem.media_url}
              className="max-h-screen max-w-full object-contain"
              autoPlay
              muted
              playsInline
              controls={false}
              onEnded={handleVideoEnded}
              onLoadedMetadata={handleVideoLoadedMetadata}
            />
          )}
        </div>
      )}

      {debugVisible && (
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/65 p-4 text-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">
                {device?.name || 'Unknown Screen'}
              </div>
              <div className="text-slate-300">
                {device?.location || 'Sans localisation'}
              </div>
            </div>

            <div className="text-right">
              <div>{currentTime.toLocaleDateString()}</div>
              <div>{currentTime.toLocaleTimeString()}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Média actuel</div>
              <div className="mt-1 font-medium">
                {currentItem?.title || 'Aucun'}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Type / durée</div>
              <div className="mt-1 font-medium">
                {currentItem
                  ? `${currentItem.media_type} • ${currentItem.duration_seconds}s`
                  : '-'}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Position boucle</div>
              <div className="mt-1 font-medium">
                {playableItems.length > 0
                  ? `${currentIndex + 1}/${playableItems.length}`
                  : '0/0'}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Plage horaire</div>
              <div className="mt-1 font-medium">
                {currentItem
                  ? `${currentItem.start_time || '00:00'} → ${
                      currentItem.end_time || '23:59'
                    }`
                  : '-'}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400">
            Appuie sur <span className="font-semibold">D</span> pour afficher ou
            masquer le panneau debug. Utilise{' '}
            <span className="font-semibold">→</span> pour passer au média
            suivant. Appuie sur <span className="font-semibold">Esc</span> pour
            revenir à la page du device.
          </div>
        </div>
      )}
    </div>
  )
}