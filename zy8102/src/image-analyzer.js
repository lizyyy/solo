import Jimp from 'jimp';
import fs from 'fs';

export class ImageAnalyzer {
  static async loadImage(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      return await Jimp.read(filePath);
    } catch {
      return null;
    }
  }

  static getImageSize(image) {
    if (!image) return { width: 0, height: 0 };
    return {
      width: image.bitmap.width,
      height: image.bitmap.height
    };
  }

  static async compareImages(baseImage, targetImage, region) {
    if (!baseImage || !targetImage) {
      return { different: false, confidence: 0 };
    }

    const baseSize = this.getImageSize(baseImage);
    const targetSize = this.getImageSize(targetImage);

    if (baseSize.width !== targetSize.width || baseSize.height !== targetSize.height) {
      return { different: true, confidence: 0, sizeMismatch: true };
    }

    const x = region.x || 0;
    const y = region.y || 0;
    const w = region.width || baseSize.width;
    const h = region.height || baseSize.height;

    let diffCount = 0;
    let totalPixels = 0;

    for (let py = y; py < Math.min(y + h, baseSize.height); py++) {
      for (let px = x; px < Math.min(x + w, baseSize.width); px++) {
        const basePixel = Jimp.intToRGBA(baseImage.getPixelColor(px, py));
        const targetPixel = Jimp.intToRGBA(targetImage.getPixelColor(px, py));

        const diff = Math.abs(basePixel.r - targetPixel.r) +
                     Math.abs(basePixel.g - targetPixel.g) +
                     Math.abs(basePixel.b - targetPixel.b);

        if (diff > 30) {
          diffCount++;
        }
        totalPixels++;
      }
    }

    const diffRatio = totalPixels > 0 ? diffCount / totalPixels : 0;
    return {
      different: diffRatio > 0.1,
      confidence: 1 - diffRatio,
      diffRatio
    };
  }

  static detectTextExpansion(baseImage, targetImage, textRegion) {
    if (!baseImage || !targetImage) return null;

    const baseSize = this.getImageSize(baseImage);
    const targetSize = this.getImageSize(targetImage);

    if (baseSize.width !== targetSize.width) {
      return { expanded: false, sizeMismatch: true };
    }

    const x = textRegion.x || 0;
    const y = textRegion.y || 0;
    const w = textRegion.width || baseSize.width;
    const h = textRegion.height || baseSize.height;

    const baseAvgBrightness = this.calculateAverageBrightness(baseImage, x, y, w, h);
    const targetAvgBrightness = this.calculateAverageBrightness(targetImage, x, y, w, h);

    const brightnessDiff = Math.abs(baseAvgBrightness - targetAvgBrightness);
    return {
      expanded: brightnessDiff > 20,
      brightnessDiff,
      baseBrightness: baseAvgBrightness,
      targetBrightness: targetAvgBrightness
    };
  }

  static calculateAverageBrightness(image, x, y, w, h) {
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let py = y; py < Math.min(y + h, image.bitmap.height); py++) {
      for (let px = x; px < Math.min(x + w, image.bitmap.width); px++) {
        const pixel = Jimp.intToRGBA(image.getPixelColor(px, py));
        totalBrightness += (pixel.r + pixel.g + pixel.b) / 3;
        pixelCount++;
      }
    }

    return pixelCount > 0 ? totalBrightness / pixelCount : 0;
  }

  static checkOverlap(region1, region2) {
    return !(
      region1.x + region1.width < region2.x ||
      region2.x + region2.width < region1.x ||
      region1.y + region1.height < region2.y ||
      region2.y + region2.height < region1.y
    );
  }
}