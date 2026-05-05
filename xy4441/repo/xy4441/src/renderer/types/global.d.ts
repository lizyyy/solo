import { Api } from '../preload';

declare global {
  interface Window {
    api: Api;
  }
}

export {};
