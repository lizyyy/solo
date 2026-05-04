import * as path from 'path';
import { glob } from 'glob';
import { Locale, LocalePackage, ScanConfig } from '../types';
import { flattenObject, readJsonFile, defaultConfig } from '../utils';

export class LocaleScanner {
  private config: ScanConfig;

  constructor(config?: Partial<ScanConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  async scan(): Promise<LocalePackage[]> {
    const localePackages: LocalePackage[] = [];
    const allFiles: string[] = [];

    for (const pattern of this.config.localePatterns) {
      const fullPattern = path.join(this.config.projectPath, pattern);
      const files = await glob(fullPattern, {
        ignore: this.config.ignorePatterns.map(p => 
          path.join(this.config.projectPath, p)
        ),
      });
      allFiles.push(...files);
    }

    const uniqueFiles = [...new Set(allFiles)];

    for (const filePath of uniqueFiles) {
      const locale = this.detectLocale(filePath);
      if (locale && this.config.locales.includes(locale)) {
        try {
          const data = readJsonFile(filePath);
          const flattened = flattenObject(data);
          
          localePackages.push({
            locale,
            path: filePath,
            data: flattened,
          });
        } catch (error) {
          console.error(`Failed to parse locale file: ${filePath}`, error);
        }
      }
    }

    return localePackages;
  }

  private detectLocale(filePath: string): Locale | null {
    const filename = path.basename(filePath, '.json');
    const dirname = path.basename(path.dirname(filePath));
    
    const localeNames: Record<string, Locale> = {
      'zh': 'zh',
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'en': 'en',
      'en-US': 'en',
      'en-GB': 'en',
      'ja': 'ja',
      'ja-JP': 'ja',
    };
    
    if (localeNames[filename]) {
      return localeNames[filename];
    }
    
    if (localeNames[dirname]) {
      return localeNames[dirname];
    }
    
    return null;
  }

  getAllKeys(localePackages: LocalePackage[]): Set<string> {
    const allKeys = new Set<string>();
    
    for (const pkg of localePackages) {
      for (const key of Object.keys(pkg.data)) {
        allKeys.add(key);
      }
    }
    
    return allKeys;
  }

  getLocaleFiles(localePackages: LocalePackage[]): string[] {
    return localePackages.map(pkg => pkg.path);
  }
}
