import { LayoutModel, DetectionResult } from '../types';

const STORAGE_KEY = 'exhibition_hall_layout';
const DETECTION_STORAGE_KEY = 'exhibition_hall_detection';

export class LocalStoragePersistence {
  public saveLayout(model: LayoutModel): void {
    try {
      const data = JSON.stringify(model);
      localStorage.setItem(STORAGE_KEY, data);
    } catch (error) {
      console.error('保存布局失败:', error);
      throw new Error('保存布局失败，请检查浏览器存储权限');
    }
  }

  public loadLayout(): LayoutModel | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as LayoutModel;
    } catch (error) {
      console.error('加载布局失败:', error);
      return null;
    }
  }

  public clearLayout(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  public saveDetectionResult(result: DetectionResult): void {
    try {
      const data = JSON.stringify(result);
      localStorage.setItem(DETECTION_STORAGE_KEY, data);
    } catch (error) {
      console.error('保存检测结果失败:', error);
    }
  }

  public loadDetectionResult(): DetectionResult | null {
    try {
      const data = localStorage.getItem(DETECTION_STORAGE_KEY);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as DetectionResult;
    } catch (error) {
      console.error('加载检测结果失败:', error);
      return null;
    }
  }

  public clearDetectionResult(): void {
    localStorage.removeItem(DETECTION_STORAGE_KEY);
  }

  public hasSavedLayout(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  public getLayoutSize(): number {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? new Blob([data]).size : 0;
  }
}
