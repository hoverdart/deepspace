import { useEffect, useState } from 'react'
import { roomAction } from './client'

export function useRoomRead<T>(action: string, roomId: string, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null)
  const key = `${action}:${roomId}:${attempt}`

  useEffect(() => {
    if (!enabled) return
    let current = true
    void roomAction<T>(action, { roomId }).then(
      (data) => { if (current) setResult({ key, data }) },
      (error: Error) => { if (current) setResult({ key, error: error.message }) },
    )
    return () => { current = false }
  }, [action, enabled, key, roomId])

  return {
    data: enabled && result?.key === key ? result.data : undefined,
    error: enabled && result?.key === key ? result.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  }
}
