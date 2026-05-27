import { StorageService } from './StorageService';
import { EelStorageAdapter } from './EelStorageAdapter';
import { WebStorageAdapter } from './WebStorageAdapter';

declare const window: any;

// 環境変数 `import.meta.env.VITE_APP_MODE` または `window.eel` の有無で判断する
// VITE_APP_MODE が 'web' の場合は window.eel があっても強制的に Web モードにする
const isWebModeExplicit = import.meta.env.VITE_APP_MODE === 'web';
const hasEel = typeof window !== 'undefined' && !!window.eel;

export const storageService: StorageService = (hasEel && !isWebModeExplicit)
  ? new EelStorageAdapter()
  : new WebStorageAdapter();

console.log(`[spaceMind] Running in ${storageService.isWebMode() ? 'Web' : 'Eel/Local'} mode.`);
export type { StorageService };
