import { InputEvent, HandActionType } from './types';
import { KEYBOARD_MAPPINGS } from './constants';
import { now } from './utils';

export interface InputAdapter {
  start(): void;
  stop(): void;
  onEvent(callback: (event: InputEvent) => void): void;
  isSupported(): boolean;
  getSource(): 'keyboard' | 'camera';
}

export abstract class BaseInputAdapter implements InputAdapter {
  protected callbacks: Array<(event: InputEvent) => void> = [];
  protected isActive: boolean = false;

  abstract start(): void;
  abstract stop(): void;
  abstract isSupported(): boolean;
  abstract getSource(): 'keyboard' | 'camera';

  onEvent(callback: (event: InputEvent) => void): void {
    this.callbacks.push(callback);
  }

  protected emitEvent(type: HandActionType): void {
    if (!this.isActive) return;
    
    const event: InputEvent = {
      type,
      timestamp: now(),
      source: this.getSource(),
    };

    this.callbacks.forEach((cb) => cb(event));
  }
}

export class KeyboardInputAdapter extends BaseInputAdapter {
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;
  private element: HTMLElement | Window;

  constructor(element: HTMLElement | Window = window) {
    super();
    this.element = element;
  }

  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.boundHandler = this.handleKeyDown.bind(this);
    this.element.addEventListener('keydown', this.boundHandler as EventListener);
  }

  stop(): void {
    if (!this.isActive || !this.boundHandler) return;
    
    this.isActive = false;
    this.element.removeEventListener('keydown', this.boundHandler as EventListener);
    this.boundHandler = null;
  }

  isSupported(): boolean {
    return true;
  }

  getSource(): 'keyboard' {
    return 'keyboard';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return;

    const code = e.code;
    const mapping = KEYBOARD_MAPPINGS[code];

    if (mapping && mapping !== 'pause') {
      e.preventDefault();
      const actionType = mapping as HandActionType;
      this.emitEvent(actionType);
    }
  }

  getKeyMappings(): Record<string, { key: string; action: string }> {
    const result: Record<string, { key: string; action: string }> = {};
    
    for (const [code, action] of Object.entries(KEYBOARD_MAPPINGS)) {
      let keyDisplay = code.replace('Key', '');
      if (code === 'Space') keyDisplay = '空格';
      
      let actionDisplay = '';
      switch (action) {
        case 'fist': actionDisplay = '握拳'; break;
        case 'palm': actionDisplay = '张掌'; break;
        case 'pinch': actionDisplay = '捏合'; break;
        case 'pause': actionDisplay = '暂停'; break;
      }
      
      result[code] = { key: keyDisplay, action: actionDisplay };
    }
    
    return result;
  }
}

export interface CameraAdapterConfig {
  videoElement?: HTMLVideoElement;
  canvasElement?: HTMLCanvasElement;
  onFrame?: (imageData: ImageData) => void;
  confidenceThreshold?: number;
}

export class CameraInputAdapter extends BaseInputAdapter {
  private config: CameraAdapterConfig;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private lastDetectedAction: HandActionType | null = null;
  private lastDetectionTime: number = 0;
  private detectionCooldownMs: number = 200;
  private confidenceThreshold: number;

  constructor(config: CameraAdapterConfig = {}) {
    super();
    this.config = config;
    this.videoElement = config.videoElement || null;
    this.canvasElement = config.canvasElement || null;
    this.confidenceThreshold = config.confidenceThreshold || 0.7;
  }

  async start(): Promise<void> {
    if (this.isActive) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);
      }

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      if (!this.canvasElement) {
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 640;
        this.canvasElement.height = 480;
      }

      this.isActive = true;
      this.startDetectionLoop();
    } catch (error) {
      console.error('Camera access denied:', error);
      throw new Error('无法访问摄像头，请检查权限设置');
    }
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isActive = false;
    this.lastDetectedAction = null;
  }

  isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  getSource(): 'camera' {
    return 'camera';
  }

  private startDetectionLoop(): void {
    const detect = () => {
      if (!this.isActive) return;

      this.processFrame();
      this.animationFrameId = requestAnimationFrame(detect);
    };

    detect();
  }

  private processFrame(): void {
    if (!this.videoElement || !this.canvasElement) return;

    const ctx = this.canvasElement.getContext('2d');
    if (!ctx) return;

    const { videoWidth, videoHeight } = this.videoElement;
    if (videoWidth === 0 || videoHeight === 0) return;

    this.canvasElement.width = videoWidth;
    this.canvasElement.height = videoHeight;

    ctx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);

    const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
    this.config.onFrame?.(imageData);

    this.detectHandAction(imageData);
  }

  private detectHandAction(_imageData: ImageData): void {
    const currentTime = now();
    
    if (currentTime - this.lastDetectionTime < this.detectionCooldownMs) {
      return;
    }

    this.lastDetectionTime = currentTime;
  }

  simulateAction(action: HandActionType): void {
    if (!this.isActive) return;
    this.emitEvent(action);
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}

export class InputAdapterManager {
  private adapters: Map<string, InputAdapter> = new Map();
  private activeAdapter: InputAdapter | null = null;
  private eventCallbacks: Array<(event: InputEvent) => void> = [];

  registerAdapter(adapter: InputAdapter): void {
    const key = adapter.getSource();
    this.adapters.set(key, adapter);
  }

  getAvailableAdapters(): string[] {
    const available: string[] = [];
    
    this.adapters.forEach((adapter, key) => {
      if (adapter.isSupported()) {
        available.push(key);
      }
    });

    return available;
  }

  selectAdapter(source: 'keyboard' | 'camera'): boolean {
    const adapter = this.adapters.get(source);
    
    if (!adapter) {
      console.error(`Adapter not found: ${source}`);
      return false;
    }

    if (!adapter.isSupported()) {
      console.error(`Adapter not supported: ${source}`);
      return false;
    }

    if (this.activeAdapter) {
      this.activeAdapter.stop();
    }

    this.activeAdapter = adapter;
    
    this.activeAdapter.onEvent((event) => {
      this.eventCallbacks.forEach((cb) => cb(event));
    });

    return true;
  }

  start(): void {
    if (this.activeAdapter) {
      this.activeAdapter.start();
    }
  }

  stop(): void {
    if (this.activeAdapter) {
      this.activeAdapter.stop();
    }
  }

  onEvent(callback: (event: InputEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  getActiveAdapter(): InputAdapter | null {
    return this.activeAdapter;
  }

  getAdapter(source: 'keyboard' | 'camera'): InputAdapter | undefined {
    return this.adapters.get(source);
  }
}
