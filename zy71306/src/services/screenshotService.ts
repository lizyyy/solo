import html2canvas from 'html2canvas';

export interface ScreenshotOptions {
  backgroundColor?: string;
  scale?: number;
  useCORS?: boolean;
  logging?: boolean;
}

export interface ScreenshotResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  fallbackDataUrl?: string;
}

const DEFAULT_OPTIONS: ScreenshotOptions = {
  backgroundColor: '#1A1A1A',
  scale: 2,
  useCORS: true,
  logging: false,
};

export const captureElement = async (
  elementId: string,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      return {
        success: false,
        error: `未找到元素: ${elementId}`,
      };
    }

    const canvas = await html2canvas(element, {
      backgroundColor: mergedOptions.backgroundColor,
      scale: mergedOptions.scale,
      useCORS: mergedOptions.useCORS,
      logging: mergedOptions.logging,
      allowTaint: true,
      foreignObjectRendering: true,
      imageTimeout: 5000,
    });

    const dataUrl = canvas.toDataURL('image/png');

    if (!dataUrl || dataUrl.length < 100) {
      return {
        success: false,
        error: '截图数据为空，可能是3D场景跨域问题',
        fallbackDataUrl: createFallbackScreenshot(),
      };
    }

    return {
      success: true,
      dataUrl,
    };
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      fallbackDataUrl: createFallbackScreenshot(),
    };
  }
};

export const captureMultipleElements = async (
  elementIds: string[],
  options: ScreenshotOptions = {}
): Promise<Map<string, ScreenshotResult>> => {
  const results = new Map<string, ScreenshotResult>();

  for (const id of elementIds) {
    results.set(id, await captureElement(id, options));
  }

  return results;
};

export const downloadScreenshot = (
  dataUrl: string,
  filename: string = 'screenshot'
): void => {
  try {
    const link = document.createElement('a');
    link.download = `${filename}_${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to download screenshot:', error);
    throw new Error('截图下载失败，请尝试右键保存');
  }
};

export const copyToClipboard = async (dataUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

const createFallbackScreenshot = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(0, 0, 800, 600);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, 700, 500);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('截图失败', 400, 280);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('3D场景无法直接截图', 400, 320);
    ctx.fillText('请使用系统截图功能', 400, 350);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText(`时间: ${new Date().toLocaleString('zh-CN')}`, 400, 400);
  }

  return canvas.toDataURL('image/png');
};

export const validateScreenshot = (dataUrl: string): boolean => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return false;
  }

  const base64Length = dataUrl.split(',')[1]?.length || 0;
  return base64Length > 1000;
};
