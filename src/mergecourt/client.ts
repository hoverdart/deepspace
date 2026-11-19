import { getAuthToken } from 'deepspace'
import { useRef, useState } from 'react'

type ActionResponse<T> = { success: true; data: T } | { success?: false; error?: string }

export async function roomAction<T = unknown>(name: string, params: Record<string, unknown> = {}) {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in again to continue.')
  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const result = await response.json().catch(() => null) as ActionResponse<T> | null
  if (response.ok && result?.success) return result.data
  if (response.status === 401) throw new Error('Sign in again to continue.')
  throw new Error(result && !result.success && result.error || 'Something went wrong. Try again.')
}

export function useRoomAction() {
  const active = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function run<T>(operation: () => Promise<T>) {
    if (active.current) return undefined
    active.current = true
    setPending(true)
    setError('')
    try {
      return await operation()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Try again.')
      return undefined
    } finally {
      active.current = false
      setPending(false)
    }
  }

  return { pending, error, run }
}
