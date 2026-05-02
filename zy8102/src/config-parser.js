import { parse } from 'csv-parse/sync';
import fs from 'fs';
import yaml from 'js-yaml';

export class ConfigParser {
  static parseManifest(csvPath) {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`screen_manifest.csv not found: ${csvPath}`);
    }
    const content = fs.readFileSync(csvPath, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    return records.map(record => ({
      device: record.device,
      page: record.page,
      language: record.language,
      filename: record.filename,
      base_language: record.base_language || 'en',
      dpr: parseInt(record.dpr) || 2
    }));
  }

  static parseLayoutRules(yamlPath) {
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`layout_rules.yaml not found: ${yamlPath}`);
    }
    const content = fs.readFileSync(yamlPath, 'utf8');
    const rules = yaml.load(content);
    return {
      safe_areas: rules.safe_areas || {},
      text_regions: rules.text_regions || [],
      button_regions: rules.button_regions || [],
      truncation_checks: rules.truncation_checks || []
    };
  }

  static groupByDevicePageLanguage(manifest) {
    const groups = {};
    manifest.forEach(entry => {
      const key = `${entry.device}-${entry.page}`;
      if (!groups[key]) {
        groups[key] = {
          device: entry.device,
          page: entry.page,
          base_language: entry.base_language,
          screenshots: []
        };
      }
      groups[key].screenshots.push(entry);
    });
    return Object.values(groups);
  }
}