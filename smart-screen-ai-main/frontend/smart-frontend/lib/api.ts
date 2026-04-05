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