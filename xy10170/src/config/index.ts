import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
  dataDir: string;
  dbPath: string;
  reportDir: string;
  historyFile: string;
  defaultExpiryWindows: number[];
}

const homeDir = os.homedir();
const defaultDataDir = path.join(homeDir, '.cert-audit');

const config: AppConfig = {
  dataDir: process.env.CERT_AUDIT_DATA_DIR || defaultDataDir,
  get dbPath() {
    return path.join(this.dataDir, 'certificates.db');
  },
  get reportDir() {
    return path.join(this.dataDir, 'reports');
  },
  get historyFile() {
    return path.join(this.dataDir, 'history.log');
  },
  defaultExpiryWindows: [7, 14, 30, 90]
};

export default config;
