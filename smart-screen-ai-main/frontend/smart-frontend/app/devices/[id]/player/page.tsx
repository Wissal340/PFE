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
  if (item.is_active === false) return false
  if (!item.media_url) return false
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
  const [mediaError, setMediaError] = useState('')

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
    }, 15000)

    return () => clearInterval(refreshInterval)
  }, [id])

  const orderedItems = useMemo(() => {
    return [...(playlist?.items || [])]
      .filter((item) => item.media_url)
      .sort((a, b) => a.order_index - b.order_index)
  }, [playlist])

  const scheduledPlayableItems = useMemo(() => {
    return orderedItems.filter((item) => isPlayable(item, currentTime))
  }, [orderedItems, currentTime])

  const activeFallbackItems = useMemo(() => {
    return orderedItems.filter((item) => item.is_active !== false)
  }, [orderedItems])

  const playableItems = useMemo(() => {
    if (scheduledPlayableItems.length > 0) return scheduledPlayableItems

    // Important pour la simulation :
    // si les horaires bloquent, on affiche quand même les médias actifs.
    return activeFallbackItems
  }, [scheduledPlayableItems, activeFallbackItems])

  useEffect(() => {
    if (currentIndex >= playableItems.length) {
      setCurrentIndex(0)
    }
  }, [playableItems.length, currentIndex])

  const currentItem =
    playableItems.length > 0 ? playableItems[currentIndex] : null

  function goToNext() {
    if (playableItems.length === 0) return
    setMediaError('')
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

    const durationMs =
      Math.max(1, Number(currentItem.duration_seconds || 10)) * 1000

    if (currentItem.media_type === 'image') {
      timerRef.current = setTimeout(() => {
        goToNext()
      }, durationMs)
    }

    if (currentItem.media_type === 'video') {
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
    currentItem?.media_url,
    currentItem?.media_type,
    currentItem?.duration_seconds,
    playableItems.length,
  ])

  function handleVideoEnded() {
    goToNext()
  }

  function handleMediaError() {
    setMediaError('Impossible de charger ce média.')
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
          <h1 className="text-3xl font-bold">Aucun média dans la playlist</h1>
          <p className="mt-3 text-sm text-slate-300">
            Ajoute un média actif dans la playlist du device.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Device: {device?.name || 'Unknown'} • {currentTime.toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <div className="flex min-h-screen items-center justify-center">
          {currentItem.media_type === 'image' ? (
            <img
              key={currentItem.media_url}
              src={currentItem.media_url}
              alt={currentItem.title || 'media'}
              className="h-screen w-screen object-contain"
              onError={handleMediaError}
            />
          ) : youtubeEmbed ? (
            <iframe
              key={youtubeEmbed}
              src={youtubeEmbed}
              title={currentItem.title || 'video'}
              className="h-screen w-screen"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              key={currentItem.media_url}
              ref={videoRef}
              src={currentItem.media_url}
              className="h-screen w-screen object-contain"
              autoPlay
              muted
              playsInline
              controls={false}
              onEnded={handleVideoEnded}
              onError={handleMediaError}
            />
          )}
        </div>
      )}

      {mediaError && (
        <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-500/30 bg-red-500/20 px-6 py-4 text-red-100 backdrop-blur">
          {mediaError}
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

          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Tous les médias</div>
              <div className="mt-1 font-medium">{orderedItems.length}</div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-xs text-slate-400">Médias programmés</div>
              <div className="mt-1 font-medium">{scheduledPlayableItems.length}</div>
            </div>

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
                  ? `${currentItem.media_type} • ${currentItem.duration_seconds || 10}s`
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
          </div>

          <div className="mt-3 break-all text-xs text-slate-400">
            URL média : {currentItem?.media_url || '-'}
          </div>

          <div className="mt-2 text-xs text-slate-400">
            D = masquer debug • → = média suivant • Esc = retour device
          </div>
        </div>
      )}
    </div>
  )
}