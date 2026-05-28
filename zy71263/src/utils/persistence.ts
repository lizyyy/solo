import type { ExportData, InterpolationConfig, Quaternion, EulerAngles } from '@/types';

const STORAGE_KEY = 'quat-sphere-params';

interface SavedParams {
  currentQuaternion: Quaternion;
  targetQuaternion: Quaternion;
  eulerAngles: EulerAngles;
  interpolationConfig: InterpolationConfig;
}

export function saveParameters(params: SavedParams): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // silently fail
  }
}

export function loadParameters(): SavedParams | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedParams;
  } catch {
    return null;
  }
}

export function exportReport(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
