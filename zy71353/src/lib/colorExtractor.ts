import { ColorSample } from '../types';
import { generateId, rgbToHex, rgbToHsl, rgbToLab, isExtremeColor } from '../utils/color';
import { getPixelAt } from '../utils/image';
import { detectBackgroundColor, isBackgroundPixel } from './backgroundDetector';

interface ExtractionOptions {
  maxColors?: number;
  minPercentage?: number;
  excludeTransparent?: boolean;
  excludeBackground?: boolean;
  excludeExtreme?: boolean;
}

interface ProcessedPixel {
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
  lab: { l: number; a: number; b: number };
}

interface ColorBucket {
  pixels: ProcessedPixel[];
  minR: number; maxR: number;
  minG: number; maxG: number;
  minB: number; maxB: number;
}

export async function extractDominantColors(
  imageData: ImageData,
  versionId: string,
  options: ExtractionOptions = {}
): Promise<{
  colors: ColorSample[];
  warnings: string[];
  excludedPixelCount: number;
  backgroundColor?: string;
}> {
  const {
    maxColors = 8,
    minPercentage = 2,
    excludeTransparent = true,
    excludeBackground = true,
    excludeExtreme = true
  } = options;

  const warnings: string[] = [];
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  const bgResult = excludeBackground ? detectBackgroundColor(imageData) : null;
  if (bgResult?.isBackground && bgResult.backgroundColor) {
    warnings.push(`检测到背景色 ${bgResult.backgroundColor}，占比 ${bgResult.backgroundPercentage.toFixed(1)}%，已排除`);
  }

  const hasTransparency = data.some((_, i) => i % 4 === 3 && data[i] < 255);
  if (hasTransparency && excludeTransparent) {
    warnings.push('图片包含透明图层，已自动排除透明像素');
  }

  const backgroundLab = bgResult?.backgroundColor
    ? rgbToLab(
        parseInt(bgResult.backgroundColor.slice(1, 3), 16),
        parseInt(bgResult.backgroundColor.slice(3, 5), 16),
        parseInt(bgResult.backgroundColor.slice(5, 7), 16)
      )
    : null;

  const processedPixels: ProcessedPixel[] = [];
  let excludedPixelCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = getPixelAt(imageData, x, y);

      if (excludeTransparent && pixel.a < 128) {
        excludedPixelCount++;
        continue;
      }

      if (excludeExtreme && isExtremeColor(pixel.r, pixel.g, pixel.b)) {
        excludedPixelCount++;
        continue;
      }

      if (excludeBackground && backgroundLab && isBackgroundPixel(pixel.r, pixel.g, pixel.b, backgroundLab)) {
        excludedPixelCount++;
        continue;
      }

      processedPixels.push({
        r: pixel.r,
        g: pixel.g,
        b: pixel.b,
        x,
        y,
        lab: rgbToLab(pixel.r, pixel.g, pixel.b)
      });
    }
  }

  if (processedPixels.length === 0) {
    throw new Error('所有像素都被排除，无法提取主色');
  }

  if (excludedPixelCount > totalPixels * 0.5) {
    warnings.push(`警告：超过50%的像素被排除（${((excludedPixelCount / totalPixels) * 100).toFixed(1)}%），结果可能不准确`);
  }

  const colorBuckets = medianCut(processedPixels, maxColors);
  const validPixels = processedPixels.length;

  const colors: ColorSample[] = colorBuckets
    .map(bucket => {
      const pixelCount = bucket.pixels.length;
      const percentage = (pixelCount / validPixels) * 100;

      if (percentage < minPercentage) return null;

      const avgR = Math.round(bucket.pixels.reduce((s, p) => s + p.r, 0) / pixelCount);
      const avgG = Math.round(bucket.pixels.reduce((s, p) => s + p.g, 0) / pixelCount);
      const avgB = Math.round(bucket.pixels.reduce((s, p) => s + p.b, 0) / pixelCount);

      const hsl = rgbToHsl(avgR, avgG, avgB);
      const lab = rgbToLab(avgR, avgG, avgB);

      const samplePixels = bucket.pixels
        .sort(() => Math.random() - 0.5)
        .slice(0, 20)
        .map(p => ({ x: p.x, y: p.y }));

      return {
        id: generateId(),
        versionId,
        hex: rgbToHex(avgR, avgG, avgB),
        rgb_r: avgR,
        rgb_g: avgG,
        rgb_b: avgB,
        hsl_h: hsl.h,
        hsl_s: hsl.s,
        hsl_l: hsl.l,
        lab_l: lab.l,
        lab_a: lab.a,
        lab_b: lab.b,
        percentage: Math.round(percentage * 100) / 100,
        isBackground: false,
        isExtreme: isExtremeColor(avgR, avgG, avgB),
        pixelCount,
        clusterPixels: samplePixels
      } as ColorSample;
    })
    .filter((c): c is ColorSample => c !== null)
    .sort((a, b) => b.percentage - a.percentage);

  return {
    colors,
    warnings,
    excludedPixelCount,
    backgroundColor: bgResult?.backgroundColor
  };
}

function medianCut(pixels: ProcessedPixel[], maxColors: number): ColorBucket[] {
  const initialBucket = createBucket(pixels);
  const buckets: ColorBucket[] = [initialBucket];

  while (buckets.length < maxColors) {
    let maxRange = -1;
    let maxIndex = -1;
    let maxChannel: 'r' | 'g' | 'b' = 'r';

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (bucket.pixels.length < 2) continue;

      const rRange = bucket.maxR - bucket.minR;
      const gRange = bucket.maxG - bucket.minG;
      const bRange = bucket.maxB - bucket.minB;

      const range = Math.max(rRange, gRange, bRange);
      if (range > maxRange) {
        maxRange = range;
        maxIndex = i;
        if (rRange >= gRange && rRange >= bRange) maxChannel = 'r';
        else if (gRange >= rRange && gRange >= bRange) maxChannel = 'g';
        else maxChannel = 'b';
      }
    }

    if (maxIndex === -1 || maxRange < 10) break;

    const bucketToSplit = buckets[maxIndex];
    const sortedPixels = [...bucketToSplit.pixels].sort((a, b) => {
      if (maxChannel === 'r') return a.r - b.r;
      if (maxChannel === 'g') return a.g - b.g;
      return a.b - b.b;
    });

    const medianIndex = Math.floor(sortedPixels.length / 2);
    const leftPixels = sortedPixels.slice(0, medianIndex);
    const rightPixels = sortedPixels.slice(medianIndex);

    if (leftPixels.length === 0 || rightPixels.length === 0) break;

    buckets.splice(maxIndex, 1, createBucket(leftPixels), createBucket(rightPixels));
  }

  return buckets.filter(b => b.pixels.length > 0);
}

function createBucket(pixels: ProcessedPixel[]): ColorBucket {
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  for (const p of pixels) {
    if (p.r < minR) minR = p.r;
    if (p.r > maxR) maxR = p.r;
    if (p.g < minG) minG = p.g;
    if (p.g > maxG) maxG = p.g;
    if (p.b < minB) minB = p.b;
    if (p.b > maxB) maxB = p.b;
  }

  return { pixels, minR, maxR, minG, maxG, minB, maxB };
}
