import { useEffect, useRef, useState, useCallback } from "react"

export type ConnectionState = "connecting" | "open" | "error" | "closed"

interface UseGazeWebSocketProps {
  sessionId: string | null
  role: "tracker" | "dashboard"
  onMessage?: (data: any) => void
}

export function useGazeWebSocket({ sessionId, role, onMessage }: UseGazeWebSocketProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("closed")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectCountRef = useRef<number>(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!sessionId) return

    setConnectionState("connecting")
    const wsUrl = `ws://localhost:8000/ws/gaze/${sessionId}?role=${role}`
    
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket

    socket.onopen = () => {
      console.log(`[WebSocket] Connected successfully as ${role}`)
      setConnectionState("open")
      reconnectCountRef.current = 0
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (onMessage) {
          onMessage(data)
        }
      } catch (err) {
        console.error("[WebSocket] Failed to parse message JSON", err)
      }
    }

    socket.onerror = (err) => {
      console.error("[WebSocket] Error occurred", err)
      setConnectionState("error")
    }

    socket.onclose = (event) => {
      console.log(`[WebSocket] Closed: ${event.reason} (code: ${event.code})`)
      setConnectionState("closed")
      
      // Auto-reconnect logic
      if (reconnectCountRef.current < maxReconnectAttempts) {
        const timeout = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 10000)
        console.log(`[WebSocket] Reconnecting in ${timeout}ms...`)
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectCountRef.current += 1
          connect()
        }, timeout)
      } else {
        console.warn("[WebSocket] Max reconnect attempts reached.")
      }
    }
  }, [sessionId, role, onMessage])

  // Explicit disconnect trigger
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  // Send function for tracker role
  const sendMetrics = useCallback((metrics: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(metrics))
    } else {
      console.warn("[WebSocket] Cannot send message: Connection not open.")
    }
  }, [])

  // Auto-connect on startup or ID change
  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    connectionState,
    sendMetrics,
    disconnect,
    reconnect: connect
  }
}
