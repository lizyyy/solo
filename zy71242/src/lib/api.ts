import type { PlayerProfile } from '@/types'

const API_BASE = '/api'

export async function fetchState(): Promise<{ profiles: PlayerProfile[]; activeProfileId: string | null }> {
  const res = await fetch(`${API_BASE}/state`)
  if (!res.ok) throw new Error('Failed to fetch state')
  return res.json()
}

export async function saveState(profiles: PlayerProfile[], activeProfileId: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles, activeProfileId }),
  })
  if (!res.ok) throw new Error('Failed to save state')
}

export async function exportFromServer(): Promise<string> {
  const res = await fetch(`${API_BASE}/export`)
  if (!res.ok) throw new Error('Failed to export')
  const data = await res.json()
  return JSON.stringify(data, null, 2)
}

export async function importToServer(json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json)
    if (!data.profiles || !Array.isArray(data.profiles)) return false
    const res = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
