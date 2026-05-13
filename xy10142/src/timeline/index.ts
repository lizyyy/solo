import type {
  AuditEvent,
  TimelineEvent,
  EventGroup,
  TimelineOptions,
  TimelineState,
  SearchOptions,
  ExportOptions,
} from '../types/index.js';
import {
  defaultTimelineOptions,
  EVENT_TYPE_COLORS,
} from '../types/index.js';
import {
  validateAuditEvent,
  validateEventGroup,
  validateSearchOptions,
  validateExportOptions,
  assertValid,
} from '../validators/index.js';
import { ExecutionLogger } from '../logger/index.js';

export class CanvasAuditTimeline {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private state: TimelineState;
  private logger: ExecutionLogger;
  private animationFrameId: number | null = null;

  constructor(options?: Partial<TimelineOptions>) {
    const mergedOptions = { ...defaultTimelineOptions, ...options };

    this.logger = new ExecutionLogger();
    this.state = {
      events: [],
      timelineEvents: [],
      groups: [],
      options: mergedOptions,
      zoom: mergedOptions.initialZoom,
      panX: 0,
      panY: 0,
      startTime: 0,
      endTime: 0,
      visibleStartTime: 0,
      visibleEndTime: 0,
      searchResults: [],
      selectedEventId: null,
      highlightedEventId: null,
      highlightedGroupId: null,
      executionLog: [],
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      panStartX: 0,
      panStartY: 0,
    };
  }

  attach(canvas: HTMLCanvasElement): void {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('必须提供有效的 HTMLCanvasElement');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('无法获取 Canvas 2D 上下文');
    }

    canvas.width = this.state.options.canvasWidth;
    canvas.height = this.state.options.canvasHeight;

    this.setupEventListeners();
    this.logger.success('attach', 'Canvas 已成功绑定');
    this.render();
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.state.zoom * delta);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.state.isDragging = true;
    this.state.dragStartX = x;
    this.state.dragStartY = y;
    this.state.panStartX = this.state.panX;
    this.state.panStartY = this.state.panY;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.canvas || !this.state.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const deltaX = x - this.state.dragStartX;
    const deltaY = y - this.state.dragStartY;

    this.state.panX = this.state.panStartX + deltaX;
    this.state.panY = this.state.panStartY + deltaY;

    this.updateVisibleTimeRange();
    this.updateTimelineEventPositions();
    this.render();
  }

  private handleMouseUp(): void {
    this.state.isDragging = false;
  }

  private handleClick(e: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedGroup = this.findGroupAtPosition(x, y);
    if (clickedGroup) {
      this.toggleGroupHighlight(clickedGroup.id);
      this.logger.success('group-click', `点击分组: ${clickedGroup.name}`);
      this.render();
      return;
    }

    const clickedEvent = this.findEventAtPosition(x, y);
    if (clickedEvent) {
      this.state.selectedEventId = clickedEvent.id;
      this.logger.success('event-select', `选中事件: ${clickedEvent.id}`);
      this.render();
    }
  }

  addEvent(event: AuditEvent): boolean {
    const validation = validateAuditEvent(event, this.state.events);
    if (!validation.valid) {
      this.logger.error('add-event', `添加事件失败: ${validation.errors.map(e => e.message).join(', ')}`);
      return false;
    }

    this.state.events.push({ ...event, tags: event.tags || [] });
    this.state.events.sort((a, b) => a.timestamp - b.timestamp);

    this.updateTimeRange();
    this.updateTimelineEventPositions();
    this.logger.success('add-event', `已添加事件: ${event.id}`, { type: event.type });
    this.render();
    return true;
  }

  addEvents(events: AuditEvent[]): { success: number; failed: number; errors: Array<{ event: Partial<AuditEvent>; errors: unknown[] }> } {
    const errors: Array<{ event: Partial<AuditEvent>; errors: unknown[] }> = [];
    let successCount = 0;

    for (const event of events) {
      const validation = validateAuditEvent(event, [...this.state.events, ...events.slice(0, events.indexOf(event))]);
      if (validation.valid) {
        this.state.events.push({ ...event, tags: event.tags || [] });
        successCount++;
      } else {
        errors.push({ event, errors: validation.errors });
      }
    }

    this.state.events.sort((a, b) => a.timestamp - b.timestamp);

    this.updateTimeRange();
    this.updateTimelineEventPositions();
    this.logger.success('add-events', `批量添加事件完成`, { success: successCount, failed: errors.length });
    this.render();

    return {
      success: successCount,
      failed: errors.length,
      errors,
    };
  }

  addGroup(group: EventGroup): boolean {
    const validation = validateEventGroup(group, this.state.events);
    if (!validation.valid) {
      this.logger.error('add-group', `添加组失败: ${validation.errors.map(e => e.message).join(', ')}`);
      return false;
    }

    this.state.groups.push({ ...group });
    this.logger.success('add-group', `已添加事件组: ${group.name}`);
    this.render();
    return true;
  }

  removeGroup(groupId: string): boolean {
    const index = this.state.groups.findIndex(g => g.id === groupId);
    if (index === -1) {
      this.logger.error('remove-group', `组不存在: ${groupId}`);
      return false;
    }

    const [removed] = this.state.groups.splice(index, 1);
    if (this.state.highlightedGroupId === groupId) {
      this.state.highlightedGroupId = null;
    }

    this.logger.success('remove-group', `已移除事件组: ${removed.name}`);
    this.render();
    return true;
  }

  clearGroups(): void {
    const count = this.state.groups.length;
    this.state.groups = [];
    this.state.highlightedGroupId = null;
    this.logger.success('clear-groups', `已清除所有事件组`, { count });
    this.render();
  }

  getGroupById(groupId: string): EventGroup | null {
    return this.state.groups.find(g => g.id === groupId) || null;
  }

  getGroupsByEvent(eventId: string): EventGroup[] {
    return this.state.groups.filter(g => g.events.includes(eventId));
  }

  addEventToGroup(groupId: string, eventId: string): boolean {
    const group = this.getGroupById(groupId);
    if (!group) {
      this.logger.error('add-event-to-group', `组不存在: ${groupId}`);
      return false;
    }

    if (!this.state.events.find(e => e.id === eventId)) {
      this.logger.error('add-event-to-group', `事件不存在: ${eventId}`);
      return false;
    }

    if (!group.events.includes(eventId)) {
      group.events.push(eventId);
      group.startTimestamp = Math.min(group.startTimestamp, ...group.events.map(id => {
        const event = this.state.events.find(e => e.id === id);
        return event?.timestamp || group.startTimestamp;
      }));
      group.endTimestamp = Math.max(group.endTimestamp, ...group.events.map(id => {
        const event = this.state.events.find(e => e.id === id);
        return event?.timestamp || group.endTimestamp;
      }));
    }

    this.logger.success('add-event-to-group', `已添加事件 ${eventId} 到组 ${group.name}`);
    this.render();
    return true;
  }

  removeEventFromGroup(groupId: string, eventId: string): boolean {
    const group = this.getGroupById(groupId);
    if (!group) {
      this.logger.error('remove-event-from-group', `组不存在: ${groupId}`);
      return false;
    }

    const index = group.events.indexOf(eventId);
    if (index === -1) {
      this.logger.error('remove-event-from-group', `事件不在组中: ${eventId}`);
      return false;
    }

    group.events.splice(index, 1);
    this.logger.success('remove-event-from-group', `已从组 ${group.name} 移除事件 ${eventId}`);
    this.render();
    return true;
  }

  toggleGroupHighlight(groupId: string): boolean {
    const group = this.getGroupById(groupId);
    if (!group) {
      return false;
    }

    if (this.state.highlightedGroupId === groupId) {
      this.state.highlightedGroupId = null;
      this.logger.success('group-toggle', `取消高亮分组: ${group.name}`);
    } else {
      this.state.highlightedGroupId = groupId;
      this.logger.success('group-toggle', `高亮分组: ${group.name}`);
    }

    this.updateTimelineEventPositions();
    this.render();
    return true;
  }

  private findGroupAtPosition(x: number, y: number): EventGroup | null {
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth } = options;

    const timeRange = visibleEndTime - visibleStartTime;
    const drawableWidth = canvasWidth - padding.left - padding.right;
    const groupBarHeight = 24;

    for (let i = 0; i < this.state.groups.length; i++) {
      const group = this.state.groups[i];
      const barY = padding.top - 60 - i * (groupBarHeight + 5);

      const startTime = Math.max(group.startTimestamp, visibleStartTime);
      const endTime = Math.min(group.endTimestamp, visibleEndTime);

      const startX = padding.left + ((startTime - visibleStartTime) / timeRange) * drawableWidth;
      const endX = padding.left + ((endTime - visibleStartTime) / timeRange) * drawableWidth;
      const width = Math.max(endX - startX, 30);

      if (x >= startX && x <= startX + width && y >= barY && y <= barY + groupBarHeight) {
        return group;
      }
    }

    return null;
  }

  private updateTimeRange(): void {
    if (this.state.events.length === 0) {
      const now = Date.now();
      this.state.startTime = now - 3600000;
      this.state.endTime = now;
    } else {
      this.state.startTime = Math.min(...this.state.events.map(e => e.timestamp));
      this.state.endTime = Math.max(...this.state.events.map(e => e.timestamp));
    }

    const range = this.state.endTime - this.state.startTime;
    if (range === 0) {
      this.state.startTime -= 300000;
      this.state.endTime += 300000;
    } else {
      const padding = range * 0.1;
      this.state.startTime -= padding;
      this.state.endTime += padding;
    }

    this.updateVisibleTimeRange();
  }

  private updateVisibleTimeRange(): void {
    const { options, zoom, panX } = this.state;
    const { padding, canvasWidth } = options;
    const drawableWidth = canvasWidth - padding.left - padding.right;

    const totalRange = this.state.endTime - this.state.startTime;
    const visibleRange = totalRange / zoom;

    const panOffset = -panX / drawableWidth * visibleRange;
    this.state.visibleStartTime = this.state.startTime + panOffset;
    this.state.visibleEndTime = this.state.visibleStartTime + visibleRange;
  }

  private updateTimelineEventPositions(): void {
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasHeight, rowHeight, eventHeight } = options;

    const drawableWidth = options.canvasWidth - padding.left - padding.right;
    const timeRange = visibleEndTime - visibleStartTime;

    const eventsByResource = new Map<string, AuditEvent[]>();
    for (const event of this.state.events) {
      const resourceEvents = eventsByResource.get(event.resourceId) || [];
      resourceEvents.push(event);
      eventsByResource.set(event.resourceId, resourceEvents);
    }

    const resources = Array.from(eventsByResource.keys());

    this.state.timelineEvents = [];

    for (const event of this.state.events) {
      const x = padding.left + ((event.timestamp - visibleStartTime) / timeRange) * drawableWidth;
      const resourceIndex = resources.indexOf(event.resourceId);
      const y = padding.top + resourceIndex * rowHeight + (rowHeight - eventHeight) / 2;

      const isInHighlightedGroup = this.state.highlightedGroupId
        ? this.state.groups
            .find(g => g.id === this.state.highlightedGroupId)
            ?.events.includes(event.id) ?? false
        : false;

      const timelineEvent: TimelineEvent = {
        ...event,
        x,
        y,
        width: Math.max(20, 100 * this.state.zoom),
        height: eventHeight,
        visible: x >= padding.left - 50 && x <= options.canvasWidth - padding.right + 50,
        highlighted: this.state.highlightedEventId === event.id
          || this.state.searchResults.includes(event.id)
          || isInHighlightedGroup,
      };

      this.state.timelineEvents.push(timelineEvent);
    }
  }

  private findEventAtPosition(x: number, y: number): TimelineEvent | null {
    for (const event of this.state.timelineEvents) {
      if (
        x >= event.x &&
        x <= event.x + event.width &&
        y >= event.y &&
        y <= event.y + event.height
      ) {
        return event;
      }
    }
    return null;
  }

  setZoom(zoom: number): void {
    const { minZoom, maxZoom } = this.state.options;
    this.state.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    this.logger.success('zoom', `缩放级别: ${this.state.zoom.toFixed(2)}`);

    this.updateVisibleTimeRange();
    this.updateTimelineEventPositions();
    this.render();
  }

  zoomIn(): void {
    this.setZoom(this.state.zoom * 1.2);
  }

  zoomOut(): void {
    this.setZoom(this.state.zoom / 1.2);
  }

  resetZoom(): void {
    this.setZoom(this.state.options.initialZoom);
    this.state.panX = 0;
    this.state.panY = 0;
    this.updateVisibleTimeRange();
    this.updateTimelineEventPositions();
    this.render();
  }

  search(options: SearchOptions): string[] {
    const validation = validateSearchOptions(options);
    assertValid(validation, '搜索选项验证失败');

    if (!options.query.trim()) {
      this.state.searchResults = [];
      this.updateTimelineEventPositions();
      this.render();
      return [];
    }

    const results: string[] = [];
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();

    for (const event of this.state.events) {
      let matched = false;

      if (options.searchIn.includes('action')) {
        const value = options.caseSensitive ? event.action : event.action.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }

      if (options.searchIn.includes('details') && event.details) {
        const value = options.caseSensitive ? event.details : event.details.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }

      if (options.searchIn.includes('userName')) {
        const value = options.caseSensitive ? event.userName : event.userName.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }

      if (options.searchIn.includes('resourceName')) {
        const value = options.caseSensitive ? event.resourceName : event.resourceName.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }

      if (options.searchIn.includes('resourceType')) {
        const value = options.caseSensitive ? event.resourceType : event.resourceType.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }

      if (options.searchIn.includes('tags') && event.tags) {
        matched = matched || event.tags.some(tag => {
          const value = options.caseSensitive ? tag : tag.toLowerCase();
          return options.exactMatch ? value === query : value.includes(query);
        });
      }

      if (matched) {
        results.push(event.id);
      }
    }

    this.state.searchResults = results;
    this.updateTimelineEventPositions();
    this.render();
    this.logger.success('search', `搜索完成`, { query: options.query, results: results.length });

    return results;
  }

  clearSearch(): void {
    this.state.searchResults = [];
    this.updateTimelineEventPositions();
    this.render();
    this.logger.success('search', '清除搜索结果');
  }

  highlightEvent(eventId: string): void {
    const event = this.state.events.find(e => e.id === eventId);
    if (event) {
      this.state.highlightedEventId = eventId;
      this.centerOnEvent(eventId);
      this.updateTimelineEventPositions();
      this.render();
      this.logger.success('highlight', `高亮事件: ${eventId}`);
    }
  }

  centerOnEvent(eventId: string): void {
    const event = this.state.events.find(e => e.id === eventId);
    if (!event) return;

    const { options } = this.state;
    const { padding, canvasWidth } = options;
    const drawableWidth = canvasWidth - padding.left - padding.right;

    const totalRange = this.state.endTime - this.state.startTime;
    const visibleRange = totalRange / this.state.zoom;

    const targetStart = event.timestamp - visibleRange / 2;
    const panOffset = (targetStart - this.state.startTime) / visibleRange * drawableWidth;

    this.state.panX = -panOffset;
    this.updateVisibleTimeRange();
    this.logger.success('center', `居中事件: ${eventId}`);
  }

  getRollbackPairs(): Array<{ rollback: AuditEvent; target: AuditEvent | undefined }> {
    const rollbackEvents = this.state.events.filter(e => e.isRollback && e.rollbackTargetId);
    return rollbackEvents.map(rollback => ({
      rollback,
      target: this.state.events.find(e => e.id === rollback.rollbackTargetId),
    }));
  }

  exportImage(options: ExportOptions = { format: 'png', quality: 0.9, backgroundColor: '#1a1a2e', includeLegend: true, includeTimestamp: true }): string | null {
    const validation = validateExportOptions(options);
    assertValid(validation, '导出选项验证失败');

    if (!this.canvas || !this.ctx) {
      this.logger.error('export', '导出失败: Canvas 未初始化');
      return null;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.state.options.canvasWidth;
    exportCanvas.height = this.state.options.canvasHeight;

    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) {
      this.logger.error('export', '导出失败: 无法创建导出上下文');
      return null;
    }

    exportCtx.fillStyle = options.backgroundColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    exportCtx.drawImage(this.canvas, 0, 0);

    if (options.includeLegend) {
      this.drawLegend(exportCtx);
    }

    if (options.includeTimestamp) {
      exportCtx.fillStyle = '#8a8aaa';
      exportCtx.font = '12px sans-serif';
      exportCtx.textAlign = 'right';
      exportCtx.fillText(
        `导出时间: ${new Date().toLocaleString()}`,
        exportCanvas.width - 10,
        exportCanvas.height - 10
      );
    }

    const dataUrl = exportCanvas.toDataURL(
      options.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      options.quality
    );

    this.logger.success('export', `导出图片成功`, { format: options.format });
    return dataUrl;
  }

  downloadImage(filename: string = 'audit-timeline', options?: ExportOptions): void {
    const dataUrl = this.exportImage(options);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `${filename}.${options?.format === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = dataUrl;
    link.click();

    this.logger.success('download', `下载图片: ${link.download}`);
  }

  private drawLegend(ctx: CanvasRenderingContext2D): void {
    const legendX = 10;
    const legendY = this.state.options.canvasHeight - 80;
    const itemHeight = 20;
    const itemWidth = 120;

    ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
    ctx.fillRect(legendX - 5, legendY - 5, itemWidth * 4 + 30, itemHeight + 20);

    const colorScheme = this.state.options.colorScheme;
    const legendItems = [
      { label: '创建', color: colorScheme.eventCreate },
      { label: '更新', color: colorScheme.eventUpdate },
      { label: '删除', color: colorScheme.eventDelete },
      { label: '回滚', color: colorScheme.eventRollback },
    ];

    legendItems.forEach((item, index) => {
      const x = legendX + index * itemWidth;
      const y = legendY + 5;

      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, 15, 15);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 20, y + 12);
    });
  }

  render(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.doRender();
      this.animationFrameId = null;
    });
  }

  private doRender(): void {
    if (!this.canvas || !this.ctx) return;

    const { options } = this.state;
    const { canvasWidth, canvasHeight, padding } = options;

    this.ctx.fillStyle = options.colorScheme.background;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (options.showGrid) {
      this.drawGrid();
    }

    if (options.showAxis) {
      this.drawTimeAxis();
      this.drawResourceAxis();
    }

    if (options.showRollbackMarkers) {
      this.drawRollbackMarkers();
    }

    if (options.showGroupHeaders) {
      this.drawGroupHeaders();
    }

    this.drawEvents();
    this.drawSelection();
  }

  private drawGrid(): void {
    if (!this.ctx) return;

    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth, canvasHeight } = options;

    this.ctx.strokeStyle = options.colorScheme.grid;
    this.ctx.lineWidth = 1;

    const timeRange = visibleEndTime - visibleStartTime;
    const interval = this.calculateTimeInterval(timeRange);

    for (let t = Math.ceil(visibleStartTime / interval) * interval; t <= visibleEndTime; t += interval) {
      const x = padding.left + ((t - visibleStartTime) / timeRange) * (canvasWidth - padding.left - padding.right);

      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, canvasHeight - padding.bottom);
      this.ctx.stroke();
    }
  }

  private calculateTimeInterval(range: number): number {
    const intervals = [
      1000,
      5000,
      15000,
      30000,
      60000,
      300000,
      600000,
      1800000,
      3600000,
      21600000,
      86400000,
    ];

    const targetCount = 10;
    const targetInterval = range / targetCount;

    for (const interval of intervals) {
      if (interval >= targetInterval) {
        return interval;
      }
    }

    return intervals[intervals.length - 1];
  }

  private drawTimeAxis(): void {
    if (!this.ctx) return;

    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth } = options;

    this.ctx.fillStyle = options.colorScheme.axis;
    this.ctx.fillRect(padding.left, padding.top - 30, canvasWidth - padding.left - padding.right, 25);

    this.ctx.fillStyle = options.colorScheme.axisText;
    this.ctx.font = '12px sans-serif';
    this.ctx.textAlign = 'center';

    const timeRange = visibleEndTime - visibleStartTime;
    const interval = this.calculateTimeInterval(timeRange);

    for (let t = Math.ceil(visibleStartTime / interval) * interval; t <= visibleEndTime; t += interval) {
      const x = padding.left + ((t - visibleStartTime) / timeRange) * (canvasWidth - padding.left - padding.right);
      const label = this.formatTime(t);

      this.ctx.fillText(label, x, padding.top - 12);
    }
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  private drawResourceAxis(): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const { options } = this.state;
    const { padding, rowHeight } = options;

    const eventsByResource = new Map<string, AuditEvent[]>();
    for (const event of this.state.events) {
      const resourceEvents = eventsByResource.get(event.resourceId) || [];
      resourceEvents.push(event);
      eventsByResource.set(event.resourceId, resourceEvents);
    }

    const resources = Array.from(eventsByResource.keys());

    ctx.fillStyle = options.colorScheme.axis;
    ctx.fillRect(0, padding.top, padding.left, resources.length * rowHeight);

    ctx.fillStyle = options.colorScheme.axisText;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    resources.forEach((resourceId, index) => {
      const events = eventsByResource.get(resourceId) || [];
      const label = events[0]?.resourceName || resourceId;
      const y = padding.top + index * rowHeight + rowHeight / 2 + 4;

      ctx.fillText(label.substring(0, 12), padding.left - 5, y);
    });
  }

  private drawRollbackMarkers(): void {
    if (!this.ctx) return;

    const rollbackPairs = this.getRollbackPairs();

    this.ctx.strokeStyle = this.state.options.colorScheme.rollbackMarker;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    for (const pair of rollbackPairs) {
      const rollbackEvent = this.state.timelineEvents.find(e => e.id === pair.rollback.id);
      const targetEvent = pair.target ? this.state.timelineEvents.find(e => e.id === pair.target?.id) : null;

      if (rollbackEvent && targetEvent) {
        this.ctx.beginPath();
        this.ctx.moveTo(rollbackEvent.x + rollbackEvent.width / 2, rollbackEvent.y + rollbackEvent.height / 2);
        this.ctx.lineTo(targetEvent.x + targetEvent.width / 2, targetEvent.y + targetEvent.height / 2);
        this.ctx.stroke();
      }
    }

    this.ctx.setLineDash([]);
  }

  private drawGroupHeaders(): void {
    if (!this.ctx || this.state.groups.length === 0) return;

    const ctx = this.ctx;
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth } = options;

    const timeRange = visibleEndTime - visibleStartTime;
    const drawableWidth = canvasWidth - padding.left - padding.right;
    const groupBarHeight = 24;

    for (let i = 0; i < this.state.groups.length; i++) {
      const group = this.state.groups[i];
      const y = padding.top - 60 - i * (groupBarHeight + 5);
      const isHighlighted = this.state.highlightedGroupId === group.id;

      const startTime = Math.max(group.startTimestamp, visibleStartTime);
      const endTime = Math.min(group.endTimestamp, visibleEndTime);

      const startX = padding.left + ((startTime - visibleStartTime) / timeRange) * drawableWidth;
      const endX = padding.left + ((endTime - visibleStartTime) / timeRange) * drawableWidth;
      const width = Math.max(endX - startX, 30);

      if (isHighlighted) {
        ctx.shadowColor = group.color;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.fillStyle = isHighlighted ? group.color + '80' : group.color + '40';
      ctx.fillRect(startX, y, width, groupBarHeight);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isHighlighted ? '#fbbf24' : group.color;
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.strokeRect(startX, y, width, groupBarHeight);

      if (width > 80) {
        ctx.fillStyle = isHighlighted ? '#fbbf24' : group.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${isHighlighted ? '✨ ' : '📁 '}${group.name}`, startX + 8, y + 16);

        ctx.fillStyle = isHighlighted ? '#ffffff' : '#8a8aaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${group.events.length} 事件`, startX + width - 8, y + 16);
      } else if (width > 40) {
        ctx.fillStyle = isHighlighted ? '#fbbf24' : '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${group.events.length}`, startX + width / 2, y + 16);
      }
    }
  }

  private drawEvents(): void {
    if (!this.ctx) return;

    const { colorScheme } = this.state.options;

    for (const event of this.state.timelineEvents) {
      if (!event.visible) continue;

      const colorKey = EVENT_TYPE_COLORS[event.type];
      let fillColor = colorScheme[colorKey];

      if (event.isRollback) {
        fillColor = colorScheme.eventRollback;
      }

      if (event.highlighted) {
        fillColor = colorScheme.highlight;
      }

      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(event.x, event.y, event.width, event.height);

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(event.x, event.y, event.width, event.height);

      if (event.isRollback) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('↩', event.x + event.width / 2, event.y + event.height / 2 + 4);
      }

      if (event.width > 60) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(event.userName.substring(0, 8), event.x + 5, event.y + event.height / 2 + 3);
      }
    }
  }

  private drawSelection(): void {
    if (!this.ctx || !this.state.selectedEventId) return;

    const event = this.state.timelineEvents.find(e => e.id === this.state.selectedEventId);
    if (!event) return;

    this.ctx.strokeStyle = this.state.options.colorScheme.selection;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(event.x - 2, event.y - 2, event.width + 4, event.height + 4);
  }

  getEvents(): AuditEvent[] {
    return [...this.state.events];
  }

  getGroups(): EventGroup[] {
    return [...this.state.groups];
  }

  getSelectedEvent(): AuditEvent | null {
    if (!this.state.selectedEventId) return null;
    return this.state.events.find(e => e.id === this.state.selectedEventId) || null;
  }

  getState(): Readonly<TimelineState> {
    return { ...this.state };
  }

  getLogger(): ExecutionLogger {
    return this.logger;
  }

  getExecutionLogs() {
    return this.logger.getLogs();
  }

  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.canvas) {
      this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp.bind(this));
      this.canvas.removeEventListener('click', this.handleClick.bind(this));
    }

    this.canvas = null;
    this.ctx = null;
    this.logger.success('destroy', 'Canvas 审计时间轴已销毁');
  }
}
