import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import * as yaml from 'js-yaml';
import { Product, Locales, FontCoverage, DeviceProfiles } from '../types';

export async function parseProductsCsv(filePath: string): Promise<Product[]> {
  const products: Product[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        products.push({
          sku: data.sku,
          name: data.name,
          price: data.price,
          original_price: data.original_price || undefined,
          tags: data.tags ? data.tags.split('|') : [],
          template_id: data.template_id,
          device_profile: data.device_profile
        });
      })
      .on('end', () => resolve(products))
      .on('error', reject);
  });
}

export function parseLocalesJson(filePath: string): Locales {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function parseFontCoverageJson(filePath: string): FontCoverage {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function parseDeviceProfilesYaml(filePath: string): DeviceProfiles {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as DeviceProfiles;
}
