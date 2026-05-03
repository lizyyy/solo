import * as fs from 'fs';
import * as path from 'path';
import { Config } from './types';

const DEFAULT_CONFIG: Config = {
  stallIds: ['stall-001'],
  stallNames: {
    'stall-001': '主摊位'
  },
  
  fees: {
    defaultRentalFee: 500,
    utilityFeePerDay: 50,
    cleaningFeePerDay: 30,
    marketingFeePerDay: 20
  },
  
  platformFees: {
    wechat: 0.006,
    alipay: 0.006,
    cash: 0,
    other: 0
  },
  
  taxes: {
    rate: 0.03,
    threshold: 100000,
    enabled: false
  },
  
  inventory: {
    damageWarningThreshold: 0.05,
    negativeStockWarning: true,
    autoAdjust: false
  },
  
  businessHours: {
    crossDayCutoff: '06:00',
    startHour: 18,
    endHour: 2
  },
  
  currency: {
    symbol: '¥',
    decimalPlaces: 2
  },
  
  output: {
    defaultFormat: 'console',
    exportDirectory: './reports'
  }
};

export function loadConfig(configPath?: string): Config {
  if (configPath && fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configContent);
      return mergeConfigs(DEFAULT_CONFIG, userConfig);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${configPath}, using defaults.`, error);
      return { ...DEFAULT_CONFIG };
    }
  }
  
  const defaultConfigPath = path.join(process.cwd(), 'nm-reconciler.json');
  if (fs.existsSync(defaultConfigPath)) {
    try {
      const configContent = fs.readFileSync(defaultConfigPath, 'utf-8');
      const userConfig = JSON.parse(configContent);
      return mergeConfigs(DEFAULT_CONFIG, userConfig);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${defaultConfigPath}, using defaults.`, error);
      return { ...DEFAULT_CONFIG };
    }
  }
  
  return { ...DEFAULT_CONFIG };
}

function mergeConfigs(base: Config, override: Partial<Config>): Config {
  const result = { ...base };
  
  if (override.stallIds) {
    result.stallIds = override.stallIds;
  }
  if (override.stallNames) {
    result.stallNames = { ...base.stallNames, ...override.stallNames };
  }
  if (override.fees) {
    result.fees = { ...base.fees, ...override.fees };
  }
  if (override.platformFees) {
    result.platformFees = { ...base.platformFees, ...override.platformFees };
  }
  if (override.taxes) {
    result.taxes = { ...base.taxes, ...override.taxes };
  }
  if (override.inventory) {
    result.inventory = { ...base.inventory, ...override.inventory };
  }
  if (override.businessHours) {
    result.businessHours = { ...base.businessHours, ...override.businessHours };
  }
  if (override.currency) {
    result.currency = { ...base.currency, ...override.currency };
  }
  if (override.output) {
    result.output = { ...base.output, ...override.output };
  }
  
  return result;
}

export function saveConfig(config: Config, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}
