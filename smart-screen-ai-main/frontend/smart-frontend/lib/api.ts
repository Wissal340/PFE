const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type LoginPayload = {
  email: string
  password: string
}

type RegisterUserPayload = {
  full_name: string
  email: string
  password: string
  role?: string
}

type RegisterDevicePayload = {
  name: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type PlaylistItemCreatePayload = {
  title?: string | null
  media_url: string
  media_type: 'image' | 'video'
  duration_seconds: number
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  is_active: boolean
}

export type PlaylistItemUpdatePayload = {
  title?: string | null
  media_url?: string | null
  media_type?: 'image' | 'video' | null
  duration_seconds?: number | null
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
}

function authHeaders(): HeadersInit {
  const token = getToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function parseJson<T>(res: Response): Promise<T | null> {
  const data = await res.json().catch(() => null)

  if (res.status === 401) {
    return null
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail?: string }).detail)
        : 'Request failed'
    throw new Error(message)
  }

  return data as T
}

export async function registerUser(payload: RegisterUserPayload) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}

export async function loginUser(payload: LoginPayload) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return parseJson<{ access_token: string; token_type: string }>(res)
}

export async function getMe() {
  const res = await fetch(`${API}/auth/me`, {
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getDevices() {
  const res = await fetch(`${API}/devices`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getDevice(id: string) {
  const res = await fetch(`${API}/devices/${id}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getAlerts(deviceId?: string) {
  const url = deviceId
    ? `${API}/alerts?device_id=${deviceId}`
    : `${API}/alerts`

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function registerDevice(payload: RegisterDevicePayload) {
  const res = await fetch(`${API}/devices/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}

export async function getLatestMetric(id: string) {
  const res = await fetch(`${API}/devices/${id}/metrics/latest`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getMetrics(id: string, limit = 20) {
  const res = await fetch(`${API}/devices/${id}/metrics?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function updateDevice(
  id: string,
  payload: {
    name?: string
    location?: string | null
    latitude?: number | null
    longitude?: number | null
    status?: string
  }
) {
  const res = await fetch(`${API}/devices/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}

export async function deleteDevice(id: string) {
  const res = await fetch(`${API}/devices/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getPlaylist(deviceId: string) {
  const res = await fetch(`${API}/devices/${deviceId}/playlist`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function addPlaylistItem(
  deviceId: string,
  payload: PlaylistItemCreatePayload
) {
  const res = await fetch(`${API}/devices/${deviceId}/playlist/items`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}

export async function updatePlaylistItem(
  itemId: number,
  payload: PlaylistItemUpdatePayload
) {
  const res = await fetch(`${API}/playlist/items/${itemId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  return parseJson(res)
}

export async function deletePlaylistItem(itemId: number) {
  const res = await fetch(`${API}/playlist/items/${itemId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function reorderPlaylist(deviceId: string, itemIds: number[]) {
  const res = await fetch(`${API}/devices/${deviceId}/playlist/reorder`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ item_ids: itemIds }),
  })

  return parseJson(res)
}

export async function uploadMedia(file: File) {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API}/upload-media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail?: string }).detail)
        : 'Upload failed'
    throw new Error(message)
  }

  return data
}

export function createWebSocket(onMessage: (data: any) => void) {
  const wsUrl =
    (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000') + '/ws'

  const socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    console.log('WebSocket connected')
    socket.send('ping')
  }

  const interval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send('ping')
    }
  }, 30000)

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      console.log('Invalid WS message')
    }
  }

  socket.onerror = () => {
    console.log('WebSocket connection error')
  }

  socket.onclose = () => {
    clearInterval(interval)
    console.log('WebSocket disconnected')
  }

  return socket
}
// =======================
// ADMIN USERS
// =======================

export async function getUsers() {
  const res = await fetch(`${API}/admin/users`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function approveUser(userId: number) {
  const res = await fetch(`${API}/admin/users/${userId}/approve`, {
    method: 'PUT',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getViewerDevices() {
  const res = await fetch(`${API}/viewer/devices`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function getViewerAssignedDevices(userId: number) {
  const res = await fetch(`${API}/admin/viewer/${userId}/devices`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}

export async function removeViewerDeviceAccess(userId: number, deviceId: string) {
  const res = await fetch(`${API}/admin/viewer/${userId}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getAiHistory(deviceId: string, limit = 30) {
  const res = await fetch(`${API}/devices/${deviceId}/ai-history?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getAiDashboardHistory(limit = 50) {
  const res = await fetch(`${API}/ai-history?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getLastCapture(deviceId: string) {
  const res = await fetch(`${API}/devices/${deviceId}/last-capture`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getDeviceCaptures(deviceId: string, limit = 20) {
  const res = await fetch(`${API}/devices/${deviceId}/captures?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getAllCaptures(limit = 50) {
  const res = await fetch(`${API}/captures?limit=${limit}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  return parseJson(res)
}
export async function getCaptureById(id: string) {
  const res = await fetch(`${API}/captures/${id}`, {
    headers: authHeaders(),
  })

  return parseJson(res)
}