import * as path from 'path';
import { AppConfig } from '../types';

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.sir-data');

export const getDefaultConfig = (): AppConfig => {
  return {
    dataDir: DEFAULT_DATA_DIR,
    snapshotsDir: path.join(DEFAULT_DATA_DIR, 'snapshots'),
    sourcesDir: path.join(DEFAULT_DATA_DIR, 'sources'),
    resultsDir: path.join(DEFAULT_DATA_DIR, 'results'),
    reportsDir: path.join(DEFAULT_DATA_DIR, 'reports'),
    historyFile: path.join(DEFAULT_DATA_DIR, 'history.json'),
    configFile: path.join(DEFAULT_DATA_DIR, 'config.json'),
  };
};

export const getConfig = (): AppConfig => {
  return getDefaultConfig();
};
