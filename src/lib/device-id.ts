const DEVICE_KEY = "wayline-device-id";

/** Stable anonymous id for this device — lets us save schedules without a login. */
export function getDeviceId(): string {
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY, id);
  return id;
}
