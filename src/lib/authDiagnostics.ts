// lib/authDiagnostics.ts
import { supabase } from '@/lib/supabaseClient'

export interface AuthDiagnostics {
  timestamp: string
  sessionId: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: string | null
  storageKeys: string[]
  storageContents: Record<string, any>
  networkStatus: 'online' | 'offline'
}

export class SessionMonitor {
  private diagnostics: AuthDiagnostics[] = []
  private interval: NodeJS.Timeout | null = null

  constructor() {
    this.startMonitoring()
  }

  private async captureSnapshot(): Promise<AuthDiagnostics> {
    const session = await supabase.auth.getSession()
    const sessionData = session.data.session

    // Get all localStorage keys related to supabase
    const storageKeys = []
    const storageContents: Record<string, any> = {}

    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.includes('supabase') || key?.includes('auth')) {
          storageKeys.push(key)
          try {
            storageContents[key] = JSON.parse(localStorage.getItem(key) || 'null')
          } catch {
            storageContents[key] = localStorage.getItem(key)
          }
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      sessionId: sessionData?.user?.id || null,
      accessToken: sessionData?.access_token ?
        `${sessionData.access_token.substring(0, 20)}...` : null,
      refreshToken: sessionData?.refresh_token ?
        `${sessionData.refresh_token.substring(0, 20)}...` : null,
      tokenExpiry: sessionData?.expires_at ?
        new Date(sessionData.expires_at * 1000).toISOString() : null,
      storageKeys,
      storageContents,
      networkStatus: navigator.onLine ? 'online' : 'offline'
    }
  }

  startMonitoring(intervalMs = 30000) { // 30 seconds
    if (this.interval) clearInterval(this.interval)

    this.interval = setInterval(async () => {
      try {
        const snapshot = await this.captureSnapshot()
        this.diagnostics.push(snapshot)

        // Keep only last 20 snapshots
        if (this.diagnostics.length > 20) {
          this.diagnostics = this.diagnostics.slice(-20)
        }

        console.log('🔍 Session Snapshot:', {
          time: snapshot.timestamp,
          hasSession: !!snapshot.sessionId,
          hasTokens: !!(snapshot.accessToken && snapshot.refreshToken),
          tokenExpiry: snapshot.tokenExpiry,
          storageKeys: snapshot.storageKeys.length,
          networkStatus: snapshot.networkStatus
        })
      } catch (error) {
        console.error('Session monitoring error:', error)
      }
    }, intervalMs)

    // Extra runtime event logging
    try {
      if (typeof window !== 'undefined') {
        const onOnline = () => console.log('📶 Network online at', new Date().toISOString())
        const onOffline = () => console.warn('📴 Network offline at', new Date().toISOString())
        const onVis = () => console.log(`👁️ Visibility: ${document.hidden ? 'hidden' : 'visible'} at`, new Date().toISOString())
        const onFocus = () => console.log('🪟 Window focus at', new Date().toISOString())
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        document.addEventListener('visibilitychange', onVis)
        window.addEventListener('focus', onFocus)
      }
    } catch {}
  }

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  getDiagnostics() {
    return [...this.diagnostics]
  }

  printReport() {
    console.group('📊 Session Diagnostics Report')
    this.diagnostics.forEach((d, i) => {
      console.log(`${i + 1}. ${d.timestamp}`, {
        session: !!d.sessionId,
        tokens: !!(d.accessToken && d.refreshToken),
        expiry: d.tokenExpiry,
        storage: d.storageKeys.length,
        network: d.networkStatus
      })
    })
    console.groupEnd()
  }

  async forceRefresh() {
    try {
      const res = await supabase.auth.refreshSession()
      console.log('🔁 Forced token refresh result:', { hasSession: !!res.data.session, error: res.error?.message })
      return res
    } catch (e) {
      console.error('Forced refresh failed:', e)
    }
  }

  async rehydrateFromLocal() {
    if (typeof window === 'undefined') return
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && /\bsb-.*-auth-token\b/i.test(k)) keys.push(k)
      }
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          const cur = parsed?.currentSession || parsed?.session || null
          const at = cur?.access_token
          const rt = cur?.refresh_token
          if (at && rt) {
            const res = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
            console.log('🔁 Rehydrate from local result:', { hasSession: !!res.data.session, error: res.error?.message })
            return res
          }
        } catch {}
      }
    } catch (e) {
      console.error('Rehydrate from local failed:', e)
    }
  }

  async testAuthOperations() {
    console.group('🧪 Testing Auth Operations')

    try {
      console.log('1. Getting current session...')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      console.log('Session result:', {
        hasSession: !!sessionData.session,
        error: sessionError?.message
      })

      console.log('2. Getting current user...')
      const { data: userData, error: userError } = await supabase.auth.getUser()
      console.log('User result:', {
        hasUser: !!userData.user,
        error: userError?.message
      })

      console.log('3. Testing database query...')
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      console.log('DB query result:', {
        hasData: !!dbData,
        error: dbError?.message
      })

      console.log('4. Testing RPC call...')
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_stats')
      console.log('RPC result:', {
        hasData: !!rpcData,
        error: rpcError?.message
      })

    } catch (error) {
      console.error('Auth operations test failed:', error)
    }

    console.groupEnd()
  }

  // Browser storage inspector
  inspectStorage() {
    if (typeof window === 'undefined') return

    console.group('💾 Browser Storage Inspector')

    console.log('LocalStorage Supabase entries:')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.includes('supabase')) {
        try {
          const value = JSON.parse(localStorage.getItem(key) || 'null')
          console.log(`${key}:`, value)
        } catch {
          console.log(`${key}:`, localStorage.getItem(key))
        }
      }
    }

    console.log('SessionStorage Supabase entries:')
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.includes('supabase')) {
        try {
          const value = JSON.parse(sessionStorage.getItem(key) || 'null')
          console.log(`${key}:`, value)
        } catch {
          console.log(`${key}:`, sessionStorage.getItem(key))
        }
      }
    }

    console.groupEnd()
  }
}

// Global instance for easy access in dev tools
let globalMonitor: SessionMonitor | null = null

export function startDiagnostics() {
  if (typeof window === 'undefined') return null

  if (globalMonitor) {
    globalMonitor.stopMonitoring()
  }

  globalMonitor = new SessionMonitor()

  // Add to window for dev tools access
  if (typeof window !== 'undefined') {
    (window as any).authMonitor = {
      test: () => globalMonitor?.testAuthOperations(),
      report: () => globalMonitor?.printReport(),
      storage: () => globalMonitor?.inspectStorage(),
      refresh: () => globalMonitor?.forceRefresh(),
      rehydrate: () => globalMonitor?.rehydrateFromLocal(),
      diagnostics: () => globalMonitor?.getDiagnostics(),
      stop: () => globalMonitor?.stopMonitoring()
    }

    console.log('🚀 Auth diagnostics started! Use window.authMonitor in dev tools:')
    console.log('  - window.authMonitor.test() - Test auth operations')
    console.log('  - window.authMonitor.report() - Print diagnostics report')
    console.log('  - window.authMonitor.storage() - Inspect browser storage')
    console.log('  - window.authMonitor.diagnostics() - Get raw diagnostics data')
    console.log('  - window.authMonitor.stop() - Stop monitoring')
  }

  return globalMonitor
}
