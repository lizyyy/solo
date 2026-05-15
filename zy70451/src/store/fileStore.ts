import fs from 'fs';
import path from 'path';
import { HandoverForm, HistoryRecord } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FORMS_FILE = path.join(DATA_DIR, 'handover-forms.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

class FileStore {
  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private readFile<T>(filePath: string, defaultValue: T): T {
    this.ensureDataDir();
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return defaultValue;
    }
  }

  private writeFile<T>(filePath: string, data: T): void {
    this.ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  getHandoverForms(): HandoverForm[] {
    return this.readFile<HandoverForm[]>(FORMS_FILE, []);
  }

  saveHandoverForms(forms: HandoverForm[]): void {
    this.writeFile(FORMS_FILE, forms);
  }

  getHandoverFormById(id: string): HandoverForm | undefined {
    const forms = this.getHandoverForms();
    return forms.find(f => f.id === id);
  }

  saveHandoverForm(form: HandoverForm): void {
    const forms = this.getHandoverForms();
    const index = forms.findIndex(f => f.id === form.id);
    if (index >= 0) {
      forms[index] = form;
    } else {
      forms.push(form);
    }
    this.saveHandoverForms(forms);
  }

  getHistoryRecords(): HistoryRecord[] {
    return this.readFile<HistoryRecord[]>(HISTORY_FILE, []);
  }

  saveHistoryRecords(records: HistoryRecord[]): void {
    this.writeFile(HISTORY_FILE, records);
  }

  addHistoryRecord(record: HistoryRecord): void {
    const records = this.getHistoryRecords();
    records.push(record);
    this.saveHistoryRecords(records);
  }
}

export const fileStore = new FileStore();
