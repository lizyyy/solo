import { LocaleScanner } from '../scanner/localeScanner';
import { SourceScanner } from '../scanner/sourceScanner';
import { Detector } from '../detector';
import { ScanResult, ScanConfig } from '../types';
import { defaultConfig } from '../utils';

export class I18nCheckerEngine {
  private config: ScanConfig;
  private localeScanner: LocaleScanner;
  private sourceScanner: SourceScanner;
  private detector: Detector;

  constructor(config?: Partial<ScanConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.localeScanner = new LocaleScanner(this.config);
    this.sourceScanner = new SourceScanner(this.config);
    this.detector = new Detector(this.config);
  }

  async scan(): Promise<ScanResult> {
    const localePackages = await this.localeScanner.scan();
    const { hardcodedStrings, usedKeys, sourceFiles } = await this.sourceScanner.scan();
    
    const issues = this.detector.detect(localePackages, hardcodedStrings, usedKeys);
    
    const allKeys = this.localeScanner.getAllKeys(localePackages);
    const localeFiles = this.localeScanner.getLocaleFiles(localePackages);

    return {
      timestamp: Date.now(),
      locales: this.config.locales,
      totalKeys: allKeys.size,
      issues,
      sourceFiles,
      localeFiles,
    };
  }

  updateConfig(config: Partial<ScanConfig>): void {
    this.config = { ...this.config, ...config };
    this.localeScanner = new LocaleScanner(this.config);
    this.sourceScanner = new SourceScanner(this.config);
    this.detector = new Detector(this.config);
  }
}
