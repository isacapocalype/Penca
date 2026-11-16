import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom/vitest';

// jsdom provides crypto.getRandomValues but not crypto.subtle. Hash helpers
// used by backup/import need the Web Crypto digest API.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
