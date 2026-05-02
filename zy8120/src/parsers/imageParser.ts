import * as fs from 'fs';
import * as path from 'path';
import ExifReader from 'exifreader';
import { ImageExif } from '../types';

export class ImageParser {
  static async getImagesFromDir(inputDir: string): Promise<string[]> {
    const imagesDir = path.join(inputDir, 'images');
    
    if (!fs.existsSync(imagesDir)) {
      throw new Error(`找不到图片目录: ${imagesDir}`);
    }
    
    const files = fs.readdirSync(imagesDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.dng'];
    
    return files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(file => path.join(imagesDir, file));
  }

  static async readExif(filePath: string): Promise<ImageExif> {
    const filename = path.basename(filePath);
    const result: ImageExif = { filename };
    
    try {
      const buffer = fs.readFileSync(filePath);
      const tags = await ExifReader.load(buffer);
      
      if (tags.DateTime) {
        result.timestamp = tags.DateTime.description;
      } else if (tags.DateTimeOriginal) {
        result.timestamp = tags.DateTimeOriginal.description;
      }
      
      if (tags.GPSLatitude && tags.GPSLatitudeRef) {
        const latValue = tags.GPSLatitude.value as unknown;
        if (Array.isArray(latValue)) {
          result.latitude = this.convertDMStoDecimal(
            latValue as number[],
            tags.GPSLatitudeRef.description
          );
        }
      }
      
      if (tags.GPSLongitude && tags.GPSLongitudeRef) {
        const lonValue = tags.GPSLongitude.value as unknown;
        if (Array.isArray(lonValue)) {
          result.longitude = this.convertDMStoDecimal(
            lonValue as number[],
            tags.GPSLongitudeRef.description
          );
        }
      }
      
      if (tags.GPSAltitude) {
        result.altitude = parseFloat(tags.GPSAltitude.description);
      }
      
      if (tags.ImageWidth) {
        result.imageWidth = parseInt(tags.ImageWidth.description, 10);
      } else if (tags['Pixel X Dimension']) {
        result.imageWidth = parseInt(tags['Pixel X Dimension'].description, 10);
      }
      
      if (tags.ImageHeight) {
        result.imageHeight = parseInt(tags.ImageHeight.description, 10);
      } else if (tags['Pixel Y Dimension']) {
        result.imageHeight = parseInt(tags['Pixel Y Dimension'].description, 10);
      }
      
      if (tags.Make) {
        result.make = tags.Make.description;
      }
      if (tags.Model) {
        result.model = tags.Model.description;
      }
      
    } catch (error) {
      console.warn(`无法读取 ${filename} 的 EXIF 数据: ${(error as Error).message}`);
    }
    
    return result;
  }

  static convertDMStoDecimal(dms: number[], ref: string): number {
    const [degrees, minutes, seconds] = dms;
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal;
    }
    
    return Number(decimal.toFixed(8));
  }

  static async readAllExifs(imagePaths: string[]): Promise<Map<string, ImageExif>> {
    const exifMap = new Map<string, ImageExif>();
    
    for (const imagePath of imagePaths) {
      const filename = path.basename(imagePath);
      const exif = await this.readExif(imagePath);
      exifMap.set(filename, exif);
    }
    
    return exifMap;
  }

  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
