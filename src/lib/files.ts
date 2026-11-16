import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

/**
 * Penyimpanan file aplikasi.
 *
 * Di perangkat memakai Filesystem native (Directory.Data). Di browser memakai
 * IndexedDB agar backup dan ekspor tetap nyata saat pengembangan. Tidak ada
 * klaim bahwa file browser adalah file sistem — unduhan/berbagi dilakukan
 * eksplisit oleh pengguna.
 */
const DATA_DIRECTORY = Directory.Data;
const BROWSER_PREFIX = 'penca:file:';

type StoredFile = { kind: 'text'; text: string } | { kind: 'bytes'; bytes: Uint8Array };

const memoryFiles = new Map<string, StoredFile>();

function storageKey(path: string): string {
  return `${BROWSER_PREFIX}${normalizePath(path)}`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getStoredFile(key: string): Promise<StoredFile | undefined> {
  if (!hasIndexedDb()) {
    return memoryFiles.get(key);
  }

  return idbGet<StoredFile>(key);
}

async function setStoredFile(key: string, value: StoredFile): Promise<void> {
  if (!hasIndexedDb()) {
    memoryFiles.set(key, value);
    return;
  }

  await idbSet(key, value);
}

async function deleteFile(key: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryFiles.delete(key);
    return;
  }

  await idbDel(key);
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

export function fileName(path: string): string {
  return normalizePath(path).split('/').pop() ?? path;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function isNativeFileSystem(): boolean {
  return Capacitor.isNativePlatform();
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    await Filesystem.writeFile({
      path: target,
      data: text,
      directory: DATA_DIRECTORY,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    return;
  }

  await setStoredFile(storageKey(target), { kind: 'text', text });
}

export async function writeBytesFile(path: string, bytes: Uint8Array): Promise<void> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    await Filesystem.writeFile({
      path: target,
      data: bytesToBase64(bytes),
      directory: DATA_DIRECTORY,
      recursive: true,
    });

    return;
  }

  await setStoredFile(storageKey(target), { kind: 'bytes', bytes });
}

export async function readTextFile(path: string): Promise<string> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    const result = await Filesystem.readFile({
      path: target,
      directory: DATA_DIRECTORY,
      encoding: Encoding.UTF8,
    });

    if (typeof result.data === 'string') {
      return result.data;
    }

    return result.data.text();
  }

  const stored = await getStoredFile(storageKey(target));

  if (!stored) {
    throw new Error('File tidak ditemukan di penyimpanan.');
  }

  if (stored.kind === 'text') {
    return stored.text;
  }

  return new TextDecoder().decode(stored.bytes);
}

export async function readBytesFile(path: string): Promise<Uint8Array> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    const result = await Filesystem.readFile({ path: target, directory: DATA_DIRECTORY });

    if (typeof result.data === 'string') {
      return base64ToBytes(result.data);
    }

    return new Uint8Array(await result.data.arrayBuffer());
  }

  const stored = await getStoredFile(storageKey(target));

  if (!stored) {
    throw new Error('File tidak ditemukan di penyimpanan.');
  }

  return stored.kind === 'text' ? new TextEncoder().encode(stored.text) : stored.bytes;
}

export async function deleteStoredFile(path: string): Promise<void> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    try {
      await Filesystem.deleteFile({ path: target, directory: DATA_DIRECTORY });
    } catch {
      // File mungkin sudah tidak ada.
    }

    return;
  }

  await deleteFile(storageKey(target));
}

export async function storedFileExists(path: string): Promise<boolean> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    try {
      await Filesystem.stat({ path: target, directory: DATA_DIRECTORY });

      return true;
    } catch {
      return false;
    }
  }

  return (await getStoredFile(storageKey(target))) !== undefined;
}

/** Berbagi file native, atau mengunduh file di browser. */
export async function shareStoredFile(path: string, title: string, mime = 'application/octet-stream'): Promise<string> {
  const target = normalizePath(path);

  if (isNativeFileSystem()) {
    const uri = await Filesystem.getUri({ path: target, directory: DATA_DIRECTORY });
    await Share.share({ title, url: uri.uri, dialogTitle: 'Bagikan file Penca' });

    return uri.uri;
  }

  const bytes = await readBytesFile(target);
  const name = fileName(target);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const file = new File([new Uint8Array(bytes)], name, { type: mime });

    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, files: [file] });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'cancelled';
        }
      }
    }
  }

  downloadBytes(name, bytes, mime);

  return 'downloaded';
}

export function downloadBytes(name: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(name: string, text: string, mime = 'text/plain'): void {
  downloadBytes(name, new TextEncoder().encode(text), mime);
}

export async function readPickedFile(file: File): Promise<{ name: string; bytes: Uint8Array; text: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  return {
    name: file.name,
    bytes,
    text: new TextDecoder('utf-8').decode(bytes),
  };
}
