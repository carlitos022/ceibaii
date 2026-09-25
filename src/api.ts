import { Capacitor } from '@capacitor/core';

const nativeApiBase = String(import.meta.env.VITE_NATIVE_API_BASE_URL || '').replace(/\/$/, '');

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isNativeApp() && nativeApiBase) return `${nativeApiBase}${normalized}`;
  return normalized;
}

export function requireNativeApiBase() {
  if (isNativeApp() && !nativeApiBase) {
    throw new Error('VITE_NATIVE_API_BASE_URL no esta configurado para Android');
  }
  return nativeApiBase;
}
