/** Asks once, on first visit, for every permission the hub uses. */
const KEY = "sknsh_permissions_asked";

export async function requestAllPermissions() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEY)) return;
  localStorage.setItem(KEY, "1");

  try {
    await Notification?.requestPermission?.();
  } catch {
    /* unsupported */
  }
  try {
    const stream = await navigator.mediaDevices?.getUserMedia({ video: true });
    stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* denied or unsupported */
  }
  try {
    navigator.geolocation?.getCurrentPosition(
      () => {},
      () => {},
      { timeout: 4000 },
    );
  } catch {
    /* denied or unsupported */
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* unsupported */
  }
}
