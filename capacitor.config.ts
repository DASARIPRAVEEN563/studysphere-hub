import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native Android wrapper for SKNSH.
 *
 * The app itself is a full-stack TanStack Start site, so the APK loads the
 * published site inside a native WebView. That gives students a real installed
 * app (app icon, internal app storage, no browser chrome) while everyone keeps
 * getting instant updates without reinstalling.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.sknsh",
  appName: "SKNSH",
  webDir: "dist",
  server: {
    url: "https://sknsh-by-pd.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b1020",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
