import Phaser from 'phaser';
import type { TransitWindow, Conflict, ViewState } from '@/types';
import { TransitWindowObject } from '../objects/TransitWindowObject';
import { ConflictMarker } from '../objects/ConflictMarker';
import { TimeScale } from '../objects/TimeScale';
import { timeToPixel } from '@/utils/timeUtils';

interface SceneEvents {
  onWindowSelect: (windowId: string) => void;
  onConflictSelect: (conflictId: string) => void;
  onViewChange: (viewState: Partial<ViewState>) => void;
}

export class TimelineScene extends Phaser.Scene {
  private windows: Map<string, TransitWindowObject> = new Map();
  private conflicts: Map<string, ConflictMarker> = new Map();
  private timeScale!: TimeScale;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private eventHandlers: Partial<SceneEvents> = {};
  
  private viewState: ViewState;
  private timelineX: number = 20;
  private timelineY: number = 60;
  private timelineWidth: number = 0;
  private timelineHeight: number = 0;
  private isPanning: boolean = false;
  private panStartX: number = 0;

  constructor(viewState: ViewState) {
    super({ key: 'TimelineScene' });
    this.viewState = viewState;
  }

  public setEventHandlers(handlers: Partial<SceneEvents>): void {
    this.eventHandlers = handlers;
  }

  create(): void {
    const { width, height } = this.scale;
    this.timelineWidth = width - 40;
    this.timelineHeight = height - 100;

    this.drawGrid();
    
    this.timeScale = new TimeScale(
      this,
      this.timelineX,
      this.timelineY,
      this.timelineWidth,
      this.viewState.startTime,
      this.viewState.endTime
    );
    this.add.existing(this.timeScale);

    this.setupInput();
    this.scale.on('resize', this.handleResize, this);
  }

  private drawGrid(): void {
    if (this.gridGraphics) {
      this.gridGraphics.destroy();
    }
    
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0x00d4ff, 0.1);
    
    for (let y = this.timelineY + 40; y < this.timelineY + this.timelineHeight; y += 40) {
      this.gridGraphics.lineBetween(this.timelineX, y, this.timelineX + this.timelineWidth, y);
    }
  }

  private setupInput(): void {
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: unknown[], deltaX: number, deltaY: number) => {
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.viewState.zoom * zoomFactor));
      this.viewState.zoom = newZoom;
      this.eventHandlers.onViewChange?.({ zoom: newZoom });
      this.updateViewRange();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > this.timelineY + 40) {
        this.isPanning = true;
        this.panStartX = pointer.x;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const deltaX = pointer.x - this.panStartX;
        this.panStartX = pointer.x;
        
        const range = new Date(this.viewState.endTime).getTime() - new Date(this.viewState.startTime).getTime();
        const timeDelta = (deltaX / this.timelineWidth) * range;
        
        const newStart = new Date(new Date(this.viewState.startTime).getTime() - timeDelta);
        const newEnd = new Date(new Date(this.viewState.endTime).getTime() - timeDelta);
        
        this.viewState.startTime = newStart.toISOString();
        this.viewState.endTime = newEnd.toISOString();
        
        this.eventHandlers.onViewChange?.({
          startTime: this.viewState.startTime,
          endTime: this.viewState.endTime
        });
        
        this.updateAllObjects();
      }
    });

    this.input.on('pointerup', () => {
      this.isPanning = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isPanning = false;
    });
  }

  private handleResize(): void {
    const { width, height } = this.scale;
    this.timelineWidth = width - 40;
    this.timelineHeight = height - 100;
    
    this.drawGrid();
    this.timeScale.updateRange(this.viewState.startTime, this.viewState.endTime, this.timelineWidth);
    this.updateAllObjects();
  }

  private updateViewRange(): void {
    const center = (new Date(this.viewState.startTime).getTime() + new Date(this.viewState.endTime).getTime()) / 2;
    const baseRange = 48 * 60 * 60 * 1000;
    const newRange = baseRange / this.viewState.zoom;
    
    this.viewState.startTime = new Date(center - newRange / 2).toISOString();
    this.viewState.endTime = new Date(center + newRange / 2).toISOString();
    
    this.eventHandlers.onViewChange?.({
      startTime: this.viewState.startTime,
      endTime: this.viewState.endTime
    });
    
    this.updateAllObjects();
  }

  public updateWindows(windowList: TransitWindow[]): void {
    const newIds = new Set(windowList.map(w => w.id));
    
    this.windows.forEach((obj, id) => {
      if (!newIds.has(id)) {
        obj.destroy();
        this.windows.delete(id);
      }
    });

    const satelliteIds = Array.from(new Set(windowList.map(w => w.satelliteId)));
    
    windowList.forEach((window, index) => {
      const rowIndex = satelliteIds.indexOf(window.satelliteId);
      const rowY = this.timelineY + 60 + rowIndex * 40;
      
      let obj = this.windows.get(window.id);
      
      if (obj) {
        obj.updateData(window);
        obj.updateBounds({
          x: this.timelineX,
          y: this.timelineY,
          width: this.timelineWidth,
          height: this.timelineHeight,
          viewStart: this.viewState.startTime,
          viewEnd: this.viewState.endTime
        });
        obj.setY(rowY);
      } else {
        obj = new TransitWindowObject(
          this,
          window,
          {
            x: this.timelineX,
            y: this.timelineY,
            width: this.timelineWidth,
            height: this.timelineHeight,
            viewStart: this.viewState.startTime,
            viewEnd: this.viewState.endTime
          },
          rowY
        );
        this.add.existing(obj);
        
        obj.on('window:select', (windowId: string) => {
          this.eventHandlers.onWindowSelect?.(windowId);
        });
        
        this.windows.set(window.id, obj);
      }
    });
  }

  public updateConflicts(conflictList: Conflict[], windows: TransitWindow[]): void {
    const newIds = new Set(conflictList.map(c => c.id));
    
    this.conflicts.forEach((obj, id) => {
      if (!newIds.has(id)) {
        obj.destroy();
        this.conflicts.delete(id);
      }
    });

    conflictList.forEach(conflict => {
      if (conflict.status === 'RESOLVED') return;
      
      const w1 = windows.find(w => w.id === conflict.windowId1);
      if (!w1) return;
      
      const centerX = timeToPixel(
        w1.startTime,
        this.viewState.startTime,
        this.viewState.endTime,
        this.timelineWidth
      );
      
      const satelliteIds = Array.from(new Set(windows.map(w => w.satelliteId)));
      const rowIndex = satelliteIds.indexOf(w1.satelliteId);
      const rowY = this.timelineY + 60 + rowIndex * 40;
      
      let obj = this.conflicts.get(conflict.id);
      
      if (obj) {
        obj.updateData(conflict);
        obj.setPosition(this.timelineX + centerX - 8, rowY - 8);
      } else {
        obj = new ConflictMarker(
          this,
          conflict,
          this.timelineX + centerX - 8,
          rowY - 8
        );
        this.add.existing(obj);
        
        obj.on('conflict:select', (conflictId: string) => {
          this.eventHandlers.onConflictSelect?.(conflictId);
        });
        
        this.conflicts.set(conflict.id, obj);
      }
    });
  }

  public selectWindow(windowId: string | null): void {
    this.windows.forEach((obj, id) => {
      obj.setSelected(id === windowId);
    });
  }

  public setViewState(viewState: ViewState): void {
    this.viewState = viewState;
    this.updateAllObjects();
  }

  private updateAllObjects(): void {
    if (this.timeScale) {
      this.timeScale.updateRange(this.viewState.startTime, this.viewState.endTime, this.timelineWidth);
    }
    
    this.windows.forEach(obj => {
      obj.updateBounds({
        x: this.timelineX,
        y: this.timelineY,
        width: this.timelineWidth,
        height: this.timelineHeight,
        viewStart: this.viewState.startTime,
        viewEnd: this.viewState.endTime
      });
    });
  }

  public cleanup(): void {
    if (this.scale) {
      this.scale.off('resize', this.handleResize, this);
    }
  }
}
