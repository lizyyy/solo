import './server';
import { initSampleData } from './initSampleData';

const args = process.argv.slice(2);

if (args.includes('--init-sample')) {
  initSampleData();
}
