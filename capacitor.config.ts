import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.penca.app',
  appName: 'Penca',
  webDir: 'dist',
  android: {
    backgroundColor: '#FAF9F6',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FAF9F6',
      overlaysWebView: false,
    },
  },
};

export default config;
