import { TabTrajectory, TabTrajectoryItem } from '../types';

export class TrajectoryParser {
  parse(jsonString: string): TabTrajectory {
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`无法解析轨迹 JSON: ${(error as Error).message}`);
    }

    return this.validateAndTransform(data);
  }

  private validateAndTransform(data: unknown): TabTrajectory {
    if (typeof data !== 'object' || data === null) {
      throw new Error('轨迹数据必须是对象');
    }

    const obj = data as Record<string, unknown>;

    const pageUrl = this.ensureString(obj.pageUrl, 'pageUrl', '');
    const snapshotId = this.ensureString(obj.snapshotId, 'snapshotId', `trajectory-${Date.now()}`);
    const timestamp = this.ensureNumber(obj.timestamp, 'timestamp', Date.now());
    const items = this.parseItems(obj.items);
    const metadata = this.parseMetadata(obj.metadata);

    return {
      pageUrl,
      snapshotId,
      timestamp,
      items,
      metadata
    };
  }

  private parseItems(items: unknown): TabTrajectoryItem[] {
    if (!Array.isArray(items)) {
      throw new Error('轨迹 items 必须是数组');
    }

    return items.map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`轨迹项 ${index} 必须是对象`);
      }

      const obj = item as Record<string, unknown>;

      return {
        timestamp: this.ensureNumber(obj.timestamp, `items[${index}].timestamp`, Date.now() + index * 100),
        selector: this.ensureString(obj.selector, `items[${index}].selector`, ''),
        xpath: this.ensureString(obj.xpath, `items[${index}].xpath`, ''),
        tagName: this.ensureString(obj.tagName, `items[${index}].tagName`, 'UNKNOWN'),
        textContent: this.ensureString(obj.textContent, `items[${index}].textContent`, ''),
        ariaLabel: this.ensureOptionalString(obj.ariaLabel),
        visible: this.ensureBoolean(obj.visible, `items[${index}].visible`, true),
        isFocused: this.ensureBoolean(obj.isFocused, `items[${index}].isFocused`, true),
        isModal: this.ensureBoolean(obj.isModal, `items[${index}].isModal`, false)
      };
    });
  }

  private parseMetadata(metadata: unknown): TabTrajectory['metadata'] {
    const defaultMetadata = {
      browser: 'Unknown',
      viewport: { width: 1920, height: 1080 }
    };

    if (typeof metadata !== 'object' || metadata === null) {
      return defaultMetadata;
    }

    const obj = metadata as Record<string, unknown>;

    return {
      browser: this.ensureString(obj.browser, 'metadata.browser', defaultMetadata.browser),
      viewport: this.parseViewport(obj.viewport)
    };
  }

  private parseViewport(viewport: unknown): { width: number; height: number } {
    const defaultViewport = { width: 1920, height: 1080 };

    if (typeof viewport !== 'object' || viewport === null) {
      return defaultViewport;
    }

    const obj = viewport as Record<string, unknown>;

    return {
      width: this.ensureNumber(obj.width, 'viewport.width', defaultViewport.width),
      height: this.ensureNumber(obj.height, 'viewport.height', defaultViewport.height)
    };
  }

  private ensureString(value: unknown, path: string, defaultValue: string): string {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    console.warn(`警告: ${path} 应为字符串，实际为 ${typeof value}，使用默认值`);
    return defaultValue;
  }

  private ensureOptionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }

  private ensureNumber(value: unknown, path: string, defaultValue: number): number {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    console.warn(`警告: ${path} 应为数字，实际为 ${typeof value}，使用默认值`);
    return defaultValue;
  }

  private ensureBoolean(value: unknown, path: string, defaultValue: boolean): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    console.warn(`警告: ${path} 应为布尔值，实际为 ${typeof value}，使用默认值`);
    return defaultValue;
  }

  analyzeTrajectory(trajectory: TabTrajectory): TrajectoryAnalysis {
    const uniqueSelectors = new Set<string>();
    const visibleItems: TabTrajectoryItem[] = [];
    const hiddenItems: TabTrajectoryItem[] = [];
    const modalItems: TabTrajectoryItem[] = [];
    const transitions: Transition[] = [];

    for (let i = 0; i < trajectory.items.length; i++) {
      const item = trajectory.items[i];
      
      uniqueSelectors.add(item.selector);
      
      if (item.visible) {
        visibleItems.push(item);
      } else {
        hiddenItems.push(item);
      }

      if (item.isModal) {
        modalItems.push(item);
      }

      if (i > 0) {
        const prevItem = trajectory.items[i - 1];
        transitions.push({
          from: prevItem,
          to: item,
          index: i,
          fromVisible: prevItem.visible,
          toVisible: item.visible,
          fromModal: prevItem.isModal,
          toModal: item.isModal
        });
      }
    }

    const contextChanges = transitions.filter(t => {
      return (t.fromModal && !t.toModal) || (!t.fromModal && t.toModal);
    });

    const visibilityChanges = transitions.filter(t => {
      return t.fromVisible !== t.toVisible;
    });

    return {
      totalItems: trajectory.items.length,
      uniqueElements: uniqueSelectors.size,
      visibleCount: visibleItems.length,
      hiddenCount: hiddenItems.length,
      modalItemsCount: modalItems.length,
      transitions,
      contextChanges,
      visibilityChanges,
      entersModal: modalItems.length > 0,
      exitsModal: contextChanges.some(c => c.fromModal && !c.toModal)
    };
  }
}

export interface TrajectoryAnalysis {
  totalItems: number;
  uniqueElements: number;
  visibleCount: number;
  hiddenCount: number;
  modalItemsCount: number;
  transitions: Transition[];
  contextChanges: Transition[];
  visibilityChanges: Transition[];
  entersModal: boolean;
  exitsModal: boolean;
}

export interface Transition {
  from: TabTrajectoryItem;
  to: TabTrajectoryItem;
  index: number;
  fromVisible: boolean;
  toVisible: boolean;
  fromModal: boolean;
  toModal: boolean;
}
