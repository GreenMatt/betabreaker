import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.betabreaker.app',
  appName: 'BetaBreaker',
  // We load the live site in a WebView; no local web assets
  webDir: 'public',
  server: {
    // Point to your production site (can change to staging when needed)
    url: 'https://www.betabreaker.app',
    cleartext: false,
  },
}

export default config

