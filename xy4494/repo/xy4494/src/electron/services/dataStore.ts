import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { LostItem, ItemStatus, ItemCategory, AppSettings, ItemPhoto } from '../../shared/types';

const DEFAULT_STATIONS = [
  '人民广场', '静安寺', '陆家嘴', '南京东路', '徐家汇',
  '人民大学', '中关村', '西二旗', '国贸', '西单',
  '北京站', '北京南站', '上海火车站', '虹桥火车站', '浦东机场',
];

const DEFAULT_SETTINGS: AppSettings = {
  defaultStation: '人民广场',
  autoJudgeEnabled: true,
  highValueThreshold: 5000,
  dataRetentionDays: 90,
  exportPath: '',
  photoStoragePath: '',
};

export class DataStore {
  private dataPath: string;
  private itemsPath: string;
  private settingsPath: string;
  private items: LostItem[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;

  constructor() {
    const userDataPath = app?.getPath ? app.getPath('userData') : './data';
    this.dataPath = path.join(userDataPath, 'subway-lost-and-found');
    this.itemsPath = path.join(this.dataPath, 'items.json');
    this.settingsPath = path.join(this.dataPath, 'settings.json');

    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.itemsPath)) {
        const data = fs.readFileSync(this.itemsPath, 'utf-8');
        this.items = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      this.items = [];
    }

    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveItems(): void {
    try {
      fs.writeFileSync(this.itemsPath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save items:', error);
    }
  }

  private saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getAllItems(): LostItem[] {
    return [...this.items];
  }

  getItemById(id: string): LostItem | null {
    const item = this.items.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  saveItem(item: LostItem): LostItem {
    const now = new Date().toISOString();

    if (item.id) {
      const index = this.items.findIndex((i) => i.id === item.id);
      if (index !== -1) {
        this.items[index] = {
          ...item,
          updatedAt: now,
        };
        this.saveItems();
        return { ...this.items[index] };
      }
    }

    const newItem: LostItem = {
      ...item,
      id: uuidv4(),
      itemCode: item.itemCode || this.generateItemCode(),
      status: item.status || ItemStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    this.items.push(newItem);
    this.saveItems();
    return { ...newItem };
  }

  deleteItem(id: string): boolean {
    const index = this.items.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.saveItems();
      return true;
    }
    return false;
  }

  searchItems(
    query: string,
    filters?: {
      stations?: string[];
      categories?: string[];
      statuses?: string[];
      dateRange?: { start: string; end: string };
    }
  ): LostItem[] {
    let results = [...this.items];

    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase().toLowerCase();
      results = results.filter((item) =>
        item.description.toLowerCase().includes(lowerQuery) ||
        item.itemCode.toLowerCase().includes(lowerQuery) ||
        item.finderName.toLowerCase().includes(lowerQuery) ||
        item.specialMarks?.toLowerCase().includes(lowerQuery) ||
        item.photos.some((p) => p.tags.some((t) => t.toLowerCase().includes(lowerQuery)))
      );
    }

    if (filters) {
      if (filters.stations && filters.stations.length > 0) {
        results = results.filter((item) => filters.stations!.includes(item.station));
      }

      if (filters.categories && filters.categories.length > 0) {
        results = results.filter((item) => filters.categories!.includes(item.category));
      }

      if (filters.statuses && filters.statuses.length > 0) {
        results = results.filter((item) => filters.statuses!.includes(item.status));
      }

      if (filters.dateRange) {
        results = results.filter((item) => {
          const itemDate = new Date(item.foundTime || item.createdAt);
          const start = new Date(filters.dateRange!.start);
          const end = new Date(filters.dateRange!.end);
          return itemDate >= start && itemDate <= end;
        });
      }
    }

    return results;
  }

  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byStation: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byStation: Record<string, number> = {};

    this.items.forEach((item) => {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      byStation[item.station] = (byStation[item.station] || 0) + 1;
    });

    return {
      total: this.items.length,
      byStatus,
      byCategory,
      byStation,
    };
  }

  getUniqueStations(): string[] {
    const stations = new Set<string>(DEFAULT_STATIONS);
    this.items.forEach((item) => stations.add(item.station));
    return Array.from(stations).sort();
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();
    return { ...this.settings };
  }

  addPhoto(
    itemId: string,
    photoData: { filePath: string; fileName: string; tags: string[]; description: string }
  ): LostItem | null {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return null;

    const photo: ItemPhoto = {
      id: uuidv4(),
      filePath: photoData.filePath,
      fileName: photoData.fileName,
      tags: photoData.tags,
      description: photoData.description,
      uploadedAt: new Date().toISOString(),
    };

    item.photos.push(photo);
    item.updatedAt = new Date().toISOString();
    this.saveItems();

    return { ...item };
  }

  updatePhoto(
    itemId: string,
    photoId: string,
    updates: Partial<{ tags: string[]; description: string }>
  ): LostItem | null {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return null;

    const photoIndex = item.photos.findIndex((p) => p.id === photoId);
    if (photoIndex === -1) return null;

    item.photos[photoIndex] = {
      ...item.photos[photoIndex],
      ...updates,
    };
    item.updatedAt = new Date().toISOString();
    this.saveItems();

    return { ...item };
  }

  deletePhoto(itemId: string, photoId: string): LostItem | null {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return null;

    const photoIndex = item.photos.findIndex((p) => p.id === photoId);
    if (photoIndex === -1) return null;

    item.photos.splice(photoIndex, 1);
    item.updatedAt = new Date().toISOString();
    this.saveItems();

    return { ...item };
  }

  private generateItemCode(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = this.items.filter((i) => i.createdAt.startsWith(dateStr.slice(0, 10))).length + 1;
    return `SW${dateStr}${String(count).padStart(4, '0')}`;
  }
}
