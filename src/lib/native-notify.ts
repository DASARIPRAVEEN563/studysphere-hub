/**
 * Phone notifications (WhatsApp style).
 *
 * Inside the installed Android app this uses Capacitor Local Notifications so
 * the alert appears in the phone's notification tray. In a normal browser it
 * falls back to the Web Notification API, and silently does nothing when the
 * user has not granted permission.
 */
let nativeReady: boolean | null = null;
let idSeed = Date.now() % 100000;

async function getNative() {
  if (nativeReady === false) return null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      nativeReady = false;
      return null;
    }
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if (nativeReady === null) {
      const perm = await LocalNotifications.requestPermissions();
      nativeReady = perm.display === "granted";
      if (!nativeReady) return null;
    }
    return LocalNotifications;
  } catch {
    nativeReady = false;
    return null;
  }
}

export async function pushNotify(title: string, body: string) {
  const native = await getNative();
  if (native) {
    try {
      await native.schedule({
        notifications: [
          {
            id: ++idSeed,
            title,
            body,
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#7c3aed",
          },
        ],
      });
      return;
    } catch {
      /* fall through to the web notification */
    }
  }
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/logo-3d.png", badge: "/logo-3d.png" });
  } catch {
    /* notifications unsupported */
  }
}
