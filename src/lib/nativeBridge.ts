// Utilities to integrate with Capacitor when running as a native app.
// These imports are dynamic/optional so web builds don’t break if
// Capacitor packages are not installed.

export function isNativePlatform(): boolean {
  try {
    // @ts-ignore - optional global injected by @capacitor/core
    const Cap = (window as any).Capacitor
    return !!Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform()
  } catch {
    return false
  }
}

export async function openExternal(url: string): Promise<void> {
  try {
    // @ts-ignore
    const mod = await import('@capacitor/browser')
    const Browser = (mod as any).Browser
    if (Browser?.open) {
      await Browser.open({ url })
      return
    }
  } catch {}
  // Fallback
  try { window.location.href = url } catch {}
}

// Listen for app deep links and route them back into the web app
// so our existing /api/auth/callback handler can run.
export async function initAppUrlListener(customScheme = 'io.betabreaker.app') {
  try {
    // @ts-ignore
    const mod = await import('@capacitor/app')
    const App = (mod as any).App
    if (!App?.addListener) return
    App.addListener('appUrlOpen', (data: any) => {
      try {
        const u = new URL(data?.url || '')
        if (u.protocol !== `${customScheme}:`) return
        // Expected: io.betabreaker.app://auth/callback?code=...&state=...
        // Route to our existing callback endpoint on the web origin.
        const path = u.pathname || '/'
        const search = u.search || ''
        const target = `${window.location.origin}${path}${search}`
        window.location.href = target
      } catch {}
    })
  } catch {}
}

