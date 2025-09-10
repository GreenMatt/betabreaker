"use client"
import { supabase } from './supabaseClient'

export class ConnectionManager {
  private static instance: ConnectionManager
  private isOnline = true
  private reconnectInterval: NodeJS.Timeout | null = null
  private listeners: Set<(online: boolean) => void> = new Set()

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  constructor() {
    this.setupEventListeners()
    this.checkConnection()
  }

  private setupEventListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setOnlineStatus(true)
        this.handleReconnect()
      })

      window.addEventListener('offline', () => {
        this.setOnlineStatus(false)
      })

      // Check connection when the page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkConnection()
        }
      })
    }
  }

  private setOnlineStatus(online: boolean) {
    if (this.isOnline !== online) {
      this.isOnline = online
      this.notifyListeners()
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline)
      } catch (error) {
        console.error('Error in connection status listener:', error)
      }
    })
  }

  private async checkConnection(): Promise<boolean> {
    try {
      // Try to get current session - this is a lightweight check
      const { data } = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
      
      this.setOnlineStatus(true)
      return true
    } catch (error) {
      this.setOnlineStatus(false)
      return false
    }
  }

  private async handleReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }

    try {
      // Try to refresh the session when reconnecting
      const { data: currentSession } = await supabase.auth.getSession()
      if (currentSession.session) {
        await supabase.auth.refreshSession()
      }
    } catch (error) {
      console.warn('Failed to refresh session on reconnect:', error)
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline
  }

  onStatusChange(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  async waitForConnection(timeout = 10000): Promise<boolean> {
    if (this.isOnline) return true

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false)
      }, timeout)

      const unsubscribe = this.onStatusChange((online) => {
        if (online) {
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(true)
        }
      })
    })
  }
}

// Create singleton instance
export const connectionManager = ConnectionManager.getInstance()