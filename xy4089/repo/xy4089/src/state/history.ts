export interface HistoryEntry<T> {
  state: T;
  description: string;
  timestamp: number;
}

export class HistoryManager<T> {
  private history: HistoryEntry<T>[] = [];
  private currentIndex = -1;
  private maxHistorySize: number;

  constructor(maxHistorySize = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  push(state: T, description: string): void {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push({
      state: JSON.parse(JSON.stringify(state)),
      description,
      timestamp: Date.now(),
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  undo(): T | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].state));
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    return JSON.parse(JSON.stringify(this.history[this.currentIndex].state));
  }

  getCurrentEntry(): HistoryEntry<T> | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex];
  }

  getUndoEntry(): HistoryEntry<T> | null {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex - 1];
  }

  getRedoEntry(): HistoryEntry<T> | null {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1];
  }

  getHistory(): HistoryEntry<T>[] {
    return this.history.map(h => ({
      state: JSON.parse(JSON.stringify(h.state)),
      description: h.description,
      timestamp: h.timestamp,
    }));
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getHistoryCount(): number {
    return this.history.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
}

export interface SelectionState {
  selectedObjectId: string | null;
  selectedObjectType: 'truss' | 'hoistPoint' | 'equipment' | 'boundary' | null;
  multiSelection: string[];
}

export interface EditorState {
  mode: 'select' | 'addTruss' | 'addHoistPoint' | 'addEquipment' | 'addBoundary';
  selection: SelectionState;
  isDragging: boolean;
  dragObjectId: string | null;
  snapToGrid: boolean;
  gridSize: number;
  showGrid: boolean;
  showWireframe: boolean;
  showLabels: boolean;
}

export const createDefaultEditorState = (): EditorState => ({
  mode: 'select',
  selection: {
    selectedObjectId: null,
    selectedObjectType: null,
    multiSelection: [],
  },
  isDragging: false,
  dragObjectId: null,
  snapToGrid: true,
  gridSize: 0.1,
  showGrid: true,
  showWireframe: false,
  showLabels: true,
});
