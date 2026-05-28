import html2canvas from 'html2canvas';
import type { Artwork, LightSource, Risk } from '@/types';

export interface ScreenshotOptions {
  includeData?: boolean;
  quality?: number;
  scale?: number;
}

export interface ScreenshotResult {
  dataUrl: string;
  timestamp: string;
  caption: string;
  dataSnapshot: {
    artworks: Artwork[];
    lightSources: LightSource[];
    risks: Risk[];
    selectedArtworkId: string | null;
    selectedLightSourceId: string | null;
    selectedRiskId: string | null;
  };
}

export async function captureScene(
  sceneElement: HTMLElement,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const { includeData = true, quality = 0.95, scale = 2 } = options;

  const canvas = await html2canvas(sceneElement, {
    backgroundColor: '#0a0a0f',
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png', quality);
  const timestamp = new Date().toISOString();

  const dataSnapshot = includeData 
    ? await captureDataSnapshot()
    : {
        artworks: [],
        lightSources: [],
        risks: [],
        selectedArtworkId: null,
        selectedLightSourceId: null,
        selectedRiskId: null,
      };

  const caption = generateScreenshotCaption(dataSnapshot);

  return {
    dataUrl,
    timestamp,
    caption,
    dataSnapshot,
  };
}

async function captureDataSnapshot() {
  const { useMainStore } = await import('@/store/mainStore');
  const state = useMainStore.getState();

  return {
    artworks: JSON.parse(JSON.stringify(state.artworks)),
    lightSources: JSON.parse(JSON.stringify(state.lightSources)),
    risks: JSON.parse(JSON.stringify(state.risks)),
    selectedArtworkId: state.selectedArtworkId,
    selectedLightSourceId: state.selectedLightSourceId,
    selectedRiskId: state.selectedRiskId,
  };
}

function generateScreenshotCaption(snapshot: ScreenshotResult['dataSnapshot']): string {
  const parts: string[] = [];
  
  if (snapshot.selectedArtworkId) {
    const artwork = snapshot.artworks.find(a => a.id === snapshot.selectedArtworkId);
    if (artwork) {
      parts.push(`作品: ${artwork.name}`);
    }
  }
  
  if (snapshot.selectedLightSourceId) {
    const light = snapshot.lightSources.find(l => l.id === snapshot.selectedLightSourceId);
    if (light) {
      parts.push(`光源: ${light.name}`);
    }
  }
  
  if (snapshot.selectedRiskId) {
    const risk = snapshot.risks.find(r => r.id === snapshot.selectedRiskId);
    if (risk) {
      parts.push(`风险: ${risk.type}`);
    }
  }
  
  if (snapshot.risks.length > 0) {
    parts.push(`风险总数: ${snapshot.risks.length}`);
  }
  
  const time = new Date().toLocaleString('zh-CN');
  parts.push(`时间: ${time}`);
  
  return parts.join(' | ');
}

export function downloadScreenshot(result: ScreenshotResult, filename?: string): void {
  const link = document.createElement('a');
  link.download = filename || `screenshot_${result.timestamp.replace(/[:.]/g, '-')}.png`;
  link.href = result.dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createScreenshotDataUrl(canvas: HTMLCanvasElement, quality = 0.95): string {
  return canvas.toDataURL('image/png', quality);
}
