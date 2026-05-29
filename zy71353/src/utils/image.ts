export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function getImageData(img: HTMLImageElement, maxSize: number = 200): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = (height / width) * maxSize;
      width = maxSize;
    } else {
      width = (width / height) * maxSize;
      height = maxSize;
    }
  }

  canvas.width = Math.floor(width);
  canvas.height = Math.floor(height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function calculateImageHash(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const imageData = getImageData(img, 64);
  const data = imageData.data;

  let hash = 0;
  for (let i = 0; i < data.length; i += 4) {
    hash = ((hash << 5) - hash + data[i] + data[i + 1] + data[i + 2]) | 0;
  }

  return Math.abs(hash).toString(16).padStart(16, '0');
}

export function hasTransparentPixels(imageData: ImageData): boolean {
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

export function getPixelAt(imageData: ImageData, x: number, y: number): { r: number; g: number; b: number; a: number } {
  const idx = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[idx],
    g: imageData.data[idx + 1],
    b: imageData.data[idx + 2],
    a: imageData.data[idx + 3]
  };
}

export function setPixelAt(imageData: ImageData, x: number, y: number, r: number, g: number, b: number, a: number = 255): void {
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = r;
  imageData.data[idx + 1] = g;
  imageData.data[idx + 2] = b;
  imageData.data[idx + 3] = a;
}

export function createImageData(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return ctx.createImageData(width, height);
}

export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

export function drawRectOnCanvas(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  alpha: number = 0.4
): void {
  const ctx = canvas.getContext('2d')!;
  const rgb = hexToRgb(color);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function resizeImageData(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;
  const targetCtx = targetCanvas.getContext('2d')!;
  targetCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  return targetCtx.getImageData(0, 0, targetWidth, targetHeight);
}
