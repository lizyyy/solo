// dist/types/index.js
var defaultTimelineOptions = {
  canvasWidth: 1200,
  canvasHeight: 600,
  padding: {
    top: 60,
    right: 20,
    bottom: 40,
    left: 80
  },
  rowHeight: 50,
  eventHeight: 30,
  eventGap: 5,
  minZoom: 0.1,
  maxZoom: 10,
  initialZoom: 1,
  colorScheme: {
    background: "#1a1a2e",
    grid: "#2a2a4a",
    axis: "#4a4a6a",
    axisText: "#8a8aaa",
    eventDefault: "#6366f1",
    eventCreate: "#10b981",
    eventUpdate: "#3b82f6",
    eventDelete: "#ef4444",
    eventRollback: "#f59e0b",
    eventRestore: "#8b5cf6",
    eventRead: "#64748b",
    eventLogin: "#06b6d4",
    eventLogout: "#78716c",
    rollbackMarker: "#f59e0b",
    highlight: "#fbbf24",
    selection: "#22d3ee",
    groupHeader: "#4f46e5"
  },
  showGrid: true,
  showAxis: true,
  showRollbackMarkers: true,
  showGroupHeaders: true
};
var EVENT_TYPE_COLORS = {
  create: "eventCreate",
  update: "eventUpdate",
  delete: "eventDelete",
  rollback: "eventRollback",
  restore: "eventRestore",
  read: "eventRead",
  login: "eventLogin",
  logout: "eventLogout"
};

// dist/validators/index.js
var VALID_EVENT_TYPES = [
  "create",
  "update",
  "delete",
  "rollback",
  "restore",
  "read",
  "login",
  "logout"
];
var HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function createValidationError(field, message, value) {
  return { field, message, value };
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function isValidTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function validateEventId(id, fieldName = "id") {
  if (!isNonEmptyString(id)) {
    return createValidationError(fieldName, "ID \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", id);
  }
  return null;
}
function validateUserId(userId) {
  if (!isNonEmptyString(userId)) {
    return createValidationError("userId", "\u7528\u6237ID \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", userId);
  }
  return null;
}
function validateTimestamp(timestamp) {
  if (!isValidTimestamp(timestamp)) {
    return createValidationError("timestamp", "\u65F6\u95F4\u6233\u5FC5\u987B\u662F\u6709\u6548\u7684\u975E\u8D1F\u6570\u5B57", timestamp);
  }
  return null;
}
function validateEventType(type) {
  if (!VALID_EVENT_TYPES.includes(type)) {
    return createValidationError("type", `\u4E8B\u4EF6\u7C7B\u578B\u5FC5\u987B\u662F\u4EE5\u4E0B\u4E4B\u4E00: ${VALID_EVENT_TYPES.join(", ")}`, type);
  }
  return null;
}
function validateResourceId(resourceId) {
  if (!isNonEmptyString(resourceId)) {
    return createValidationError("resourceId", "\u8D44\u6E90ID \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", resourceId);
  }
  return null;
}
function validateColor(color, fieldName = "color") {
  if (!isNonEmptyString(color) || !HEX_COLOR_REGEX.test(color)) {
    return createValidationError(fieldName, "\u989C\u8272\u5FC5\u987B\u662F\u6709\u6548\u7684 HEX \u683C\u5F0F (#xxx \u6216 #xxxxxx)", color);
  }
  return null;
}
function validateAuditEvent(event, existingEvents) {
  const errors = [];
  if (event === null || event === void 0) {
    return { valid: false, errors: [createValidationError("event", "\u5BA1\u8BA1\u4E8B\u4EF6\u4E0D\u80FD\u4E3A\u7A7A")] };
  }
  const e = event;
  const idError = validateEventId(e.id || "");
  if (idError)
    errors.push(idError);
  const timestampError = validateTimestamp(e.timestamp ?? -1);
  if (timestampError)
    errors.push(timestampError);
  const typeError = validateEventType(e.type || "");
  if (typeError)
    errors.push(typeError);
  const userIdError = validateUserId(e.userId || "");
  if (userIdError)
    errors.push(userIdError);
  if (!isNonEmptyString(e.userName)) {
    errors.push(createValidationError("userName", "\u7528\u6237\u540D\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", e.userName));
  }
  const resourceIdError = validateResourceId(e.resourceId || "");
  if (resourceIdError)
    errors.push(resourceIdError);
  if (!isNonEmptyString(e.resourceName)) {
    errors.push(createValidationError("resourceName", "\u8D44\u6E90\u540D\u79F0\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", e.resourceName));
  }
  if (!isNonEmptyString(e.resourceType)) {
    errors.push(createValidationError("resourceType", "\u8D44\u6E90\u7C7B\u578B\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", e.resourceType));
  }
  if (!isNonEmptyString(e.action)) {
    errors.push(createValidationError("action", "\u64CD\u4F5C\u63CF\u8FF0\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", e.action));
  }
  if (e.tags !== void 0 && !Array.isArray(e.tags)) {
    errors.push(createValidationError("tags", "\u6807\u7B7E\u5FC5\u987B\u662F\u6570\u7EC4", e.tags));
  } else if (Array.isArray(e.tags) && !e.tags.every((tag) => typeof tag === "string")) {
    errors.push(createValidationError("tags", "\u6240\u6709\u6807\u7B7E\u5FC5\u987B\u662F\u5B57\u7B26\u4E32", e.tags));
  }
  if (e.isRollback && !isNonEmptyString(e.rollbackTargetId)) {
    errors.push(createValidationError("rollbackTargetId", "\u56DE\u6EDA\u4E8B\u4EF6\u5FC5\u987B\u6307\u5B9A\u76EE\u6807\u4E8B\u4EF6ID", e.rollbackTargetId));
  }
  if (e.rollbackTargetId) {
    if (existingEvents) {
      const targetExists = existingEvents.some((ev) => ev.id === e.rollbackTargetId);
      if (!targetExists) {
        errors.push(createValidationError("rollbackTargetId", "\u56DE\u6EDA\u76EE\u6807\u4E8B\u4EF6ID\u4E0D\u5B58\u5728", e.rollbackTargetId));
      }
    }
  }
  if (existingEvents && e.id) {
    const duplicate = existingEvents.some((ev) => ev.id === e.id);
    if (duplicate) {
      errors.push(createValidationError("id", "\u4E8B\u4EF6ID\u5DF2\u5B58\u5728", e.id));
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateEventGroup(group, existingEvents) {
  const errors = [];
  if (group === null || group === void 0) {
    return { valid: false, errors: [createValidationError("group", "\u4E8B\u4EF6\u7EC4\u4E0D\u80FD\u4E3A\u7A7A")] };
  }
  const g = group;
  if (!isNonEmptyString(g.id)) {
    errors.push(createValidationError("id", "\u7EC4ID\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", g.id));
  }
  if (!isNonEmptyString(g.name)) {
    errors.push(createValidationError("name", "\u7EC4\u540D\u79F0\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32", g.name));
  }
  const colorError = validateColor(g.color || "");
  if (colorError)
    errors.push(colorError);
  if (!Array.isArray(g.events)) {
    errors.push(createValidationError("events", "\u4E8B\u4EF6\u5217\u8868\u5FC5\u987B\u662F\u6570\u7EC4", g.events));
  } else {
    for (const eventId of g.events) {
      const idError = validateEventId(eventId);
      if (idError)
        errors.push(idError);
      if (existingEvents) {
        const eventExists = existingEvents.some((ev) => ev.id === eventId);
        if (!eventExists) {
          errors.push(createValidationError("events", `\u4E8B\u4EF6ID\u4E0D\u5B58\u5728: ${eventId}`, eventId));
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateTimelineOptions(options) {
  const errors = [];
  if (options === null || options === void 0) {
    return { valid: false, errors: [createValidationError("options", "\u914D\u7F6E\u9009\u9879\u4E0D\u80FD\u4E3A\u7A7A")] };
  }
  const o = options;
  if (o.canvasWidth !== void 0 && !isPositiveNumber(o.canvasWidth)) {
    errors.push(createValidationError("canvasWidth", "\u753B\u5E03\u5BBD\u5EA6\u5FC5\u987B\u662F\u6B63\u6570", o.canvasWidth));
  }
  if (o.canvasHeight !== void 0 && !isPositiveNumber(o.canvasHeight)) {
    errors.push(createValidationError("canvasHeight", "\u753B\u5E03\u9AD8\u5EA6\u5FC5\u987B\u662F\u6B63\u6570", o.canvasHeight));
  }
  if (o.minZoom !== void 0 && !isPositiveNumber(o.minZoom)) {
    errors.push(createValidationError("minZoom", "\u6700\u5C0F\u7F29\u653E\u7EA7\u522B\u5FC5\u987B\u662F\u6B63\u6570", o.minZoom));
  }
  if (o.maxZoom !== void 0 && !isPositiveNumber(o.maxZoom)) {
    errors.push(createValidationError("maxZoom", "\u6700\u5927\u7F29\u653E\u7EA7\u522B\u5FC5\u987B\u662F\u6B63\u6570", o.maxZoom));
  }
  if (o.minZoom !== void 0 && o.maxZoom !== void 0 && o.minZoom >= o.maxZoom) {
    errors.push(createValidationError("maxZoom", "\u6700\u5927\u7F29\u653E\u7EA7\u522B\u5FC5\u987B\u5927\u4E8E\u6700\u5C0F\u7F29\u653E\u7EA7\u522B", o.maxZoom));
  }
  if (o.initialZoom !== void 0) {
    const min = o.minZoom ?? 0.1;
    const max = o.maxZoom ?? 10;
    if (!isPositiveNumber(o.initialZoom) || o.initialZoom < min || o.initialZoom > max) {
      errors.push(createValidationError("initialZoom", `\u521D\u59CB\u7F29\u653E\u7EA7\u522B\u5FC5\u987B\u5728 [${min}, ${max}] \u8303\u56F4\u5185`, o.initialZoom));
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateSearchOptions(options) {
  const errors = [];
  if (options === null || options === void 0) {
    return { valid: false, errors: [createValidationError("options", "\u641C\u7D22\u9009\u9879\u4E0D\u80FD\u4E3A\u7A7A")] };
  }
  const o = options;
  if (o.query === void 0 || o.query === null) {
    errors.push(createValidationError("query", "\u641C\u7D22\u67E5\u8BE2\u4E0D\u80FD\u4E3A\u7A7A"));
  }
  const validSearchFields = [
    "action",
    "details",
    "userName",
    "resourceName",
    "resourceType",
    "tags"
  ];
  if (o.searchIn !== void 0) {
    if (!Array.isArray(o.searchIn)) {
      errors.push(createValidationError("searchIn", "\u641C\u7D22\u5B57\u6BB5\u5FC5\u987B\u662F\u6570\u7EC4", o.searchIn));
    } else {
      for (const field of o.searchIn) {
        if (!validSearchFields.includes(field)) {
          errors.push(createValidationError("searchIn", `\u65E0\u6548\u7684\u641C\u7D22\u5B57\u6BB5: ${field}`, field));
        }
      }
    }
  }
  if (o.caseSensitive !== void 0 && typeof o.caseSensitive !== "boolean") {
    errors.push(createValidationError("caseSensitive", "caseSensitive \u5FC5\u987B\u662F\u5E03\u5C14\u503C", o.caseSensitive));
  }
  if (o.exactMatch !== void 0 && typeof o.exactMatch !== "boolean") {
    errors.push(createValidationError("exactMatch", "exactMatch \u5FC5\u987B\u662F\u5E03\u5C14\u503C", o.exactMatch));
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateExportOptions(options) {
  const errors = [];
  if (options === null || options === void 0) {
    return { valid: false, errors: [createValidationError("options", "\u5BFC\u51FA\u9009\u9879\u4E0D\u80FD\u4E3A\u7A7A")] };
  }
  const o = options;
  if (o.format !== void 0 && !["png", "jpeg"].includes(o.format)) {
    errors.push(createValidationError("format", "\u683C\u5F0F\u5FC5\u987B\u662F png \u6216 jpeg", o.format));
  }
  if (o.quality !== void 0) {
    if (typeof o.quality !== "number" || o.quality < 0 || o.quality > 1) {
      errors.push(createValidationError("quality", "\u8D28\u91CF\u5FC5\u987B\u662F 0 \u5230 1 \u4E4B\u95F4\u7684\u6570\u5B57", o.quality));
    }
  }
  if (o.backgroundColor !== void 0) {
    const colorError = validateColor(o.backgroundColor, "backgroundColor");
    if (colorError)
      errors.push(colorError);
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
var ValidationException = class extends Error {
  constructor(message, errors) {
    super(message);
    this.name = "ValidationException";
    this.errors = errors;
  }
};
function assertValid(result, message = "\u9A8C\u8BC1\u5931\u8D25") {
  if (!result.valid) {
    throw new ValidationException(message, result.errors);
  }
}

// dist/logger/index.js
var ExecutionLogger = class {
  constructor(maxLogs = 1e3) {
    this.logs = [];
    this.maxLogs = 1e3;
    this.maxLogs = maxLogs;
  }
  log(action, success, message, details) {
    const entry = {
      timestamp: Date.now(),
      action,
      success,
      message,
      details
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    return entry;
  }
  success(action, message, details) {
    return this.log(action, true, message, details);
  }
  error(action, message, details) {
    return this.log(action, false, message, details);
  }
  getLogs() {
    return [...this.logs];
  }
  getErrors() {
    return this.logs.filter((log) => !log.success);
  }
  getSuccesses() {
    return this.logs.filter((log) => log.success);
  }
  getByAction(action) {
    return this.logs.filter((log) => log.action === action);
  }
  getRecent(count = 50) {
    return this.logs.slice(-count);
  }
  clear() {
    this.logs = [];
  }
  getStats() {
    const total = this.logs.length;
    const success = this.logs.filter((l) => l.success).length;
    const error = total - success;
    const successRate = total > 0 ? success / total * 100 : 0;
    return { total, success, error, successRate };
  }
  export(format) {
    if (format === "json") {
      return JSON.stringify(this.logs, null, 2);
    }
    const headers = ["timestamp", "action", "success", "message", "details"];
    const csvLines = [headers.join(",")];
    for (const log of this.logs) {
      const line = [
        log.timestamp,
        `"${log.action.replace(/"/g, '""')}"`,
        log.success,
        `"${log.message.replace(/"/g, '""')}"`,
        log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ""
      ].join(",");
      csvLines.push(line);
    }
    return csvLines.join("\n");
  }
};

// dist/timeline/index.js
var CanvasAuditTimeline = class {
  constructor(options) {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
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
      panStartY: 0
    };
  }
  attach(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("\u5FC5\u987B\u63D0\u4F9B\u6709\u6548\u7684 HTMLCanvasElement");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) {
      throw new Error("\u65E0\u6CD5\u83B7\u53D6 Canvas 2D \u4E0A\u4E0B\u6587");
    }
    canvas.width = this.state.options.canvasWidth;
    canvas.height = this.state.options.canvasHeight;
    this.setupEventListeners();
    this.logger.success("attach", "Canvas \u5DF2\u6210\u529F\u7ED1\u5B9A");
    this.render();
  }
  setupEventListeners() {
    if (!this.canvas)
      return;
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("click", this.handleClick.bind(this));
  }
  handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.state.zoom * delta);
  }
  handleMouseDown(e) {
    if (!this.canvas)
      return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.state.isDragging = true;
    this.state.dragStartX = x;
    this.state.dragStartY = y;
    this.state.panStartX = this.state.panX;
    this.state.panStartY = this.state.panY;
  }
  handleMouseMove(e) {
    if (!this.canvas || !this.state.isDragging)
      return;
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
  handleMouseUp() {
    this.state.isDragging = false;
  }
  handleClick(e) {
    if (!this.canvas)
      return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedGroup = this.findGroupAtPosition(x, y);
    if (clickedGroup) {
      this.toggleGroupHighlight(clickedGroup.id);
      this.logger.success("group-click", `\u70B9\u51FB\u5206\u7EC4: ${clickedGroup.name}`);
      this.render();
      return;
    }
    const clickedEvent = this.findEventAtPosition(x, y);
    if (clickedEvent) {
      this.state.selectedEventId = clickedEvent.id;
      this.logger.success("event-select", `\u9009\u4E2D\u4E8B\u4EF6: ${clickedEvent.id}`);
      this.render();
    }
  }
  addEvent(event) {
    const validation = validateAuditEvent(event, this.state.events);
    if (!validation.valid) {
      this.logger.error("add-event", `\u6DFB\u52A0\u4E8B\u4EF6\u5931\u8D25: ${validation.errors.map((e) => e.message).join(", ")}`);
      return false;
    }
    this.state.events.push({ ...event, tags: event.tags || [] });
    this.state.events.sort((a, b) => a.timestamp - b.timestamp);
    this.updateTimeRange();
    this.updateTimelineEventPositions();
    this.logger.success("add-event", `\u5DF2\u6DFB\u52A0\u4E8B\u4EF6: ${event.id}`, { type: event.type });
    this.render();
    return true;
  }
  addEvents(events) {
    const errors = [];
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
    this.logger.success("add-events", `\u6279\u91CF\u6DFB\u52A0\u4E8B\u4EF6\u5B8C\u6210`, { success: successCount, failed: errors.length });
    this.render();
    return {
      success: successCount,
      failed: errors.length,
      errors
    };
  }
  addGroup(group) {
    const validation = validateEventGroup(group, this.state.events);
    if (!validation.valid) {
      this.logger.error("add-group", `\u6DFB\u52A0\u7EC4\u5931\u8D25: ${validation.errors.map((e) => e.message).join(", ")}`);
      return false;
    }
    this.state.groups.push({ ...group });
    this.logger.success("add-group", `\u5DF2\u6DFB\u52A0\u4E8B\u4EF6\u7EC4: ${group.name}`);
    this.render();
    return true;
  }
  removeGroup(groupId) {
    const index = this.state.groups.findIndex((g) => g.id === groupId);
    if (index === -1) {
      this.logger.error("remove-group", `\u7EC4\u4E0D\u5B58\u5728: ${groupId}`);
      return false;
    }
    const [removed] = this.state.groups.splice(index, 1);
    if (this.state.highlightedGroupId === groupId) {
      this.state.highlightedGroupId = null;
    }
    this.logger.success("remove-group", `\u5DF2\u79FB\u9664\u4E8B\u4EF6\u7EC4: ${removed.name}`);
    this.render();
    return true;
  }
  clearGroups() {
    const count = this.state.groups.length;
    this.state.groups = [];
    this.state.highlightedGroupId = null;
    this.logger.success("clear-groups", `\u5DF2\u6E05\u9664\u6240\u6709\u4E8B\u4EF6\u7EC4`, { count });
    this.render();
  }
  getGroupById(groupId) {
    return this.state.groups.find((g) => g.id === groupId) || null;
  }
  getGroupsByEvent(eventId) {
    return this.state.groups.filter((g) => g.events.includes(eventId));
  }
  addEventToGroup(groupId, eventId) {
    const group = this.getGroupById(groupId);
    if (!group) {
      this.logger.error("add-event-to-group", `\u7EC4\u4E0D\u5B58\u5728: ${groupId}`);
      return false;
    }
    if (!this.state.events.find((e) => e.id === eventId)) {
      this.logger.error("add-event-to-group", `\u4E8B\u4EF6\u4E0D\u5B58\u5728: ${eventId}`);
      return false;
    }
    if (!group.events.includes(eventId)) {
      group.events.push(eventId);
      group.startTimestamp = Math.min(group.startTimestamp, ...group.events.map((id) => {
        const event = this.state.events.find((e) => e.id === id);
        return event?.timestamp || group.startTimestamp;
      }));
      group.endTimestamp = Math.max(group.endTimestamp, ...group.events.map((id) => {
        const event = this.state.events.find((e) => e.id === id);
        return event?.timestamp || group.endTimestamp;
      }));
    }
    this.logger.success("add-event-to-group", `\u5DF2\u6DFB\u52A0\u4E8B\u4EF6 ${eventId} \u5230\u7EC4 ${group.name}`);
    this.render();
    return true;
  }
  removeEventFromGroup(groupId, eventId) {
    const group = this.getGroupById(groupId);
    if (!group) {
      this.logger.error("remove-event-from-group", `\u7EC4\u4E0D\u5B58\u5728: ${groupId}`);
      return false;
    }
    const index = group.events.indexOf(eventId);
    if (index === -1) {
      this.logger.error("remove-event-from-group", `\u4E8B\u4EF6\u4E0D\u5728\u7EC4\u4E2D: ${eventId}`);
      return false;
    }
    group.events.splice(index, 1);
    this.logger.success("remove-event-from-group", `\u5DF2\u4ECE\u7EC4 ${group.name} \u79FB\u9664\u4E8B\u4EF6 ${eventId}`);
    this.render();
    return true;
  }
  toggleGroupHighlight(groupId) {
    const group = this.getGroupById(groupId);
    if (!group) {
      return false;
    }
    if (this.state.highlightedGroupId === groupId) {
      this.state.highlightedGroupId = null;
      this.logger.success("group-toggle", `\u53D6\u6D88\u9AD8\u4EAE\u5206\u7EC4: ${group.name}`);
    } else {
      this.state.highlightedGroupId = groupId;
      this.logger.success("group-toggle", `\u9AD8\u4EAE\u5206\u7EC4: ${group.name}`);
    }
    this.updateTimelineEventPositions();
    this.render();
    return true;
  }
  findGroupAtPosition(x, y) {
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
      const startX = padding.left + (startTime - visibleStartTime) / timeRange * drawableWidth;
      const endX = padding.left + (endTime - visibleStartTime) / timeRange * drawableWidth;
      const width = Math.max(endX - startX, 30);
      if (x >= startX && x <= startX + width && y >= barY && y <= barY + groupBarHeight) {
        return group;
      }
    }
    return null;
  }
  updateTimeRange() {
    if (this.state.events.length === 0) {
      const now2 = Date.now();
      this.state.startTime = now2 - 36e5;
      this.state.endTime = now2;
    } else {
      this.state.startTime = Math.min(...this.state.events.map((e) => e.timestamp));
      this.state.endTime = Math.max(...this.state.events.map((e) => e.timestamp));
    }
    const range = this.state.endTime - this.state.startTime;
    if (range === 0) {
      this.state.startTime -= 3e5;
      this.state.endTime += 3e5;
    } else {
      const padding = range * 0.1;
      this.state.startTime -= padding;
      this.state.endTime += padding;
    }
    this.updateVisibleTimeRange();
  }
  updateVisibleTimeRange() {
    const { options, zoom, panX } = this.state;
    const { padding, canvasWidth } = options;
    const drawableWidth = canvasWidth - padding.left - padding.right;
    const totalRange = this.state.endTime - this.state.startTime;
    const visibleRange = totalRange / zoom;
    const panOffset = -panX / drawableWidth * visibleRange;
    this.state.visibleStartTime = this.state.startTime + panOffset;
    this.state.visibleEndTime = this.state.visibleStartTime + visibleRange;
  }
  updateTimelineEventPositions() {
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasHeight, rowHeight, eventHeight } = options;
    const drawableWidth = options.canvasWidth - padding.left - padding.right;
    const timeRange = visibleEndTime - visibleStartTime;
    const eventsByResource = /* @__PURE__ */ new Map();
    for (const event of this.state.events) {
      const resourceEvents = eventsByResource.get(event.resourceId) || [];
      resourceEvents.push(event);
      eventsByResource.set(event.resourceId, resourceEvents);
    }
    const resources = Array.from(eventsByResource.keys());
    this.state.timelineEvents = [];
    for (const event of this.state.events) {
      const x = padding.left + (event.timestamp - visibleStartTime) / timeRange * drawableWidth;
      const resourceIndex = resources.indexOf(event.resourceId);
      const y = padding.top + resourceIndex * rowHeight + (rowHeight - eventHeight) / 2;
      const isInHighlightedGroup = this.state.highlightedGroupId ? this.state.groups.find((g) => g.id === this.state.highlightedGroupId)?.events.includes(event.id) ?? false : false;
      const timelineEvent = {
        ...event,
        x,
        y,
        width: Math.max(20, 100 * this.state.zoom),
        height: eventHeight,
        visible: x >= padding.left - 50 && x <= options.canvasWidth - padding.right + 50,
        highlighted: this.state.highlightedEventId === event.id || this.state.searchResults.includes(event.id) || isInHighlightedGroup
      };
      this.state.timelineEvents.push(timelineEvent);
    }
  }
  findEventAtPosition(x, y) {
    for (const event of this.state.timelineEvents) {
      if (x >= event.x && x <= event.x + event.width && y >= event.y && y <= event.y + event.height) {
        return event;
      }
    }
    return null;
  }
  setZoom(zoom) {
    const { minZoom, maxZoom } = this.state.options;
    this.state.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    this.logger.success("zoom", `\u7F29\u653E\u7EA7\u522B: ${this.state.zoom.toFixed(2)}`);
    this.updateVisibleTimeRange();
    this.updateTimelineEventPositions();
    this.render();
  }
  zoomIn() {
    this.setZoom(this.state.zoom * 1.2);
  }
  zoomOut() {
    this.setZoom(this.state.zoom / 1.2);
  }
  resetZoom() {
    this.setZoom(this.state.options.initialZoom);
    this.state.panX = 0;
    this.state.panY = 0;
    this.updateVisibleTimeRange();
    this.updateTimelineEventPositions();
    this.render();
  }
  search(options) {
    const validation = validateSearchOptions(options);
    assertValid(validation, "\u641C\u7D22\u9009\u9879\u9A8C\u8BC1\u5931\u8D25");
    if (!options.query.trim()) {
      this.state.searchResults = [];
      this.updateTimelineEventPositions();
      this.render();
      return [];
    }
    const results = [];
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();
    for (const event of this.state.events) {
      let matched = false;
      if (options.searchIn.includes("action")) {
        const value = options.caseSensitive ? event.action : event.action.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }
      if (options.searchIn.includes("details") && event.details) {
        const value = options.caseSensitive ? event.details : event.details.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }
      if (options.searchIn.includes("userName")) {
        const value = options.caseSensitive ? event.userName : event.userName.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }
      if (options.searchIn.includes("resourceName")) {
        const value = options.caseSensitive ? event.resourceName : event.resourceName.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }
      if (options.searchIn.includes("resourceType")) {
        const value = options.caseSensitive ? event.resourceType : event.resourceType.toLowerCase();
        matched = matched || (options.exactMatch ? value === query : value.includes(query));
      }
      if (options.searchIn.includes("tags") && event.tags) {
        matched = matched || event.tags.some((tag) => {
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
    this.logger.success("search", `\u641C\u7D22\u5B8C\u6210`, { query: options.query, results: results.length });
    return results;
  }
  clearSearch() {
    this.state.searchResults = [];
    this.updateTimelineEventPositions();
    this.render();
    this.logger.success("search", "\u6E05\u9664\u641C\u7D22\u7ED3\u679C");
  }
  highlightEvent(eventId) {
    const event = this.state.events.find((e) => e.id === eventId);
    if (event) {
      this.state.highlightedEventId = eventId;
      this.centerOnEvent(eventId);
      this.updateTimelineEventPositions();
      this.render();
      this.logger.success("highlight", `\u9AD8\u4EAE\u4E8B\u4EF6: ${eventId}`);
    }
  }
  centerOnEvent(eventId) {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event)
      return;
    const { options } = this.state;
    const { padding, canvasWidth } = options;
    const drawableWidth = canvasWidth - padding.left - padding.right;
    const totalRange = this.state.endTime - this.state.startTime;
    const visibleRange = totalRange / this.state.zoom;
    const targetStart = event.timestamp - visibleRange / 2;
    const panOffset = (targetStart - this.state.startTime) / visibleRange * drawableWidth;
    this.state.panX = -panOffset;
    this.updateVisibleTimeRange();
    this.logger.success("center", `\u5C45\u4E2D\u4E8B\u4EF6: ${eventId}`);
  }
  getRollbackPairs() {
    const rollbackEvents = this.state.events.filter((e) => e.isRollback && e.rollbackTargetId);
    return rollbackEvents.map((rollback) => ({
      rollback,
      target: this.state.events.find((e) => e.id === rollback.rollbackTargetId)
    }));
  }
  exportImage(options = { format: "png", quality: 0.9, backgroundColor: "#1a1a2e", includeLegend: true, includeTimestamp: true }) {
    const validation = validateExportOptions(options);
    assertValid(validation, "\u5BFC\u51FA\u9009\u9879\u9A8C\u8BC1\u5931\u8D25");
    if (!this.canvas || !this.ctx) {
      this.logger.error("export", "\u5BFC\u51FA\u5931\u8D25: Canvas \u672A\u521D\u59CB\u5316");
      return null;
    }
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.state.options.canvasWidth;
    exportCanvas.height = this.state.options.canvasHeight;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) {
      this.logger.error("export", "\u5BFC\u51FA\u5931\u8D25: \u65E0\u6CD5\u521B\u5EFA\u5BFC\u51FA\u4E0A\u4E0B\u6587");
      return null;
    }
    exportCtx.fillStyle = options.backgroundColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(this.canvas, 0, 0);
    if (options.includeLegend) {
      this.drawLegend(exportCtx);
    }
    if (options.includeTimestamp) {
      exportCtx.fillStyle = "#8a8aaa";
      exportCtx.font = "12px sans-serif";
      exportCtx.textAlign = "right";
      exportCtx.fillText(`\u5BFC\u51FA\u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toLocaleString()}`, exportCanvas.width - 10, exportCanvas.height - 10);
    }
    const dataUrl = exportCanvas.toDataURL(options.format === "jpeg" ? "image/jpeg" : "image/png", options.quality);
    this.logger.success("export", `\u5BFC\u51FA\u56FE\u7247\u6210\u529F`, { format: options.format });
    return dataUrl;
  }
  downloadImage(filename = "audit-timeline", options) {
    const dataUrl = this.exportImage(options);
    if (!dataUrl)
      return;
    const link = document.createElement("a");
    link.download = `${filename}.${options?.format === "jpeg" ? "jpg" : "png"}`;
    link.href = dataUrl;
    link.click();
    this.logger.success("download", `\u4E0B\u8F7D\u56FE\u7247: ${link.download}`);
  }
  drawLegend(ctx) {
    const legendX = 10;
    const legendY = this.state.options.canvasHeight - 80;
    const itemHeight = 20;
    const itemWidth = 120;
    ctx.fillStyle = "rgba(26, 26, 46, 0.9)";
    ctx.fillRect(legendX - 5, legendY - 5, itemWidth * 4 + 30, itemHeight + 20);
    const colorScheme = this.state.options.colorScheme;
    const legendItems = [
      { label: "\u521B\u5EFA", color: colorScheme.eventCreate },
      { label: "\u66F4\u65B0", color: colorScheme.eventUpdate },
      { label: "\u5220\u9664", color: colorScheme.eventDelete },
      { label: "\u56DE\u6EDA", color: colorScheme.eventRollback }
    ];
    legendItems.forEach((item, index) => {
      const x = legendX + index * itemWidth;
      const y = legendY + 5;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, 15, 15);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.label, x + 20, y + 12);
    });
  }
  render() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(() => {
      this.doRender();
      this.animationFrameId = null;
    });
  }
  doRender() {
    if (!this.canvas || !this.ctx)
      return;
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
  drawGrid() {
    if (!this.ctx)
      return;
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth, canvasHeight } = options;
    this.ctx.strokeStyle = options.colorScheme.grid;
    this.ctx.lineWidth = 1;
    const timeRange = visibleEndTime - visibleStartTime;
    const interval = this.calculateTimeInterval(timeRange);
    for (let t = Math.ceil(visibleStartTime / interval) * interval; t <= visibleEndTime; t += interval) {
      const x = padding.left + (t - visibleStartTime) / timeRange * (canvasWidth - padding.left - padding.right);
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, canvasHeight - padding.bottom);
      this.ctx.stroke();
    }
  }
  calculateTimeInterval(range) {
    const intervals = [
      1e3,
      5e3,
      15e3,
      3e4,
      6e4,
      3e5,
      6e5,
      18e5,
      36e5,
      216e5,
      864e5
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
  drawTimeAxis() {
    if (!this.ctx)
      return;
    const { options, visibleStartTime, visibleEndTime } = this.state;
    const { padding, canvasWidth } = options;
    this.ctx.fillStyle = options.colorScheme.axis;
    this.ctx.fillRect(padding.left, padding.top - 30, canvasWidth - padding.left - padding.right, 25);
    this.ctx.fillStyle = options.colorScheme.axisText;
    this.ctx.font = "12px sans-serif";
    this.ctx.textAlign = "center";
    const timeRange = visibleEndTime - visibleStartTime;
    const interval = this.calculateTimeInterval(timeRange);
    for (let t = Math.ceil(visibleStartTime / interval) * interval; t <= visibleEndTime; t += interval) {
      const x = padding.left + (t - visibleStartTime) / timeRange * (canvasWidth - padding.left - padding.right);
      const label = this.formatTime(t);
      this.ctx.fillText(label, x, padding.top - 12);
    }
  }
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
  drawResourceAxis() {
    if (!this.ctx)
      return;
    const ctx = this.ctx;
    const { options } = this.state;
    const { padding, rowHeight } = options;
    const eventsByResource = /* @__PURE__ */ new Map();
    for (const event of this.state.events) {
      const resourceEvents = eventsByResource.get(event.resourceId) || [];
      resourceEvents.push(event);
      eventsByResource.set(event.resourceId, resourceEvents);
    }
    const resources = Array.from(eventsByResource.keys());
    ctx.fillStyle = options.colorScheme.axis;
    ctx.fillRect(0, padding.top, padding.left, resources.length * rowHeight);
    ctx.fillStyle = options.colorScheme.axisText;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    resources.forEach((resourceId, index) => {
      const events = eventsByResource.get(resourceId) || [];
      const label = events[0]?.resourceName || resourceId;
      const y = padding.top + index * rowHeight + rowHeight / 2 + 4;
      ctx.fillText(label.substring(0, 12), padding.left - 5, y);
    });
  }
  drawRollbackMarkers() {
    if (!this.ctx)
      return;
    const rollbackPairs = this.getRollbackPairs();
    this.ctx.strokeStyle = this.state.options.colorScheme.rollbackMarker;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    for (const pair of rollbackPairs) {
      const rollbackEvent = this.state.timelineEvents.find((e) => e.id === pair.rollback.id);
      const targetEvent = pair.target ? this.state.timelineEvents.find((e) => e.id === pair.target?.id) : null;
      if (rollbackEvent && targetEvent) {
        this.ctx.beginPath();
        this.ctx.moveTo(rollbackEvent.x + rollbackEvent.width / 2, rollbackEvent.y + rollbackEvent.height / 2);
        this.ctx.lineTo(targetEvent.x + targetEvent.width / 2, targetEvent.y + targetEvent.height / 2);
        this.ctx.stroke();
      }
    }
    this.ctx.setLineDash([]);
  }
  drawGroupHeaders() {
    if (!this.ctx || this.state.groups.length === 0)
      return;
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
      const startX = padding.left + (startTime - visibleStartTime) / timeRange * drawableWidth;
      const endX = padding.left + (endTime - visibleStartTime) / timeRange * drawableWidth;
      const width = Math.max(endX - startX, 30);
      if (isHighlighted) {
        ctx.shadowColor = group.color;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      ctx.fillStyle = isHighlighted ? group.color + "80" : group.color + "40";
      ctx.fillRect(startX, y, width, groupBarHeight);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isHighlighted ? "#fbbf24" : group.color;
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.strokeRect(startX, y, width, groupBarHeight);
      if (width > 80) {
        ctx.fillStyle = isHighlighted ? "#fbbf24" : group.color;
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${isHighlighted ? "\u2728 " : "\u{1F4C1} "}${group.name}`, startX + 8, y + 16);
        ctx.fillStyle = isHighlighted ? "#ffffff" : "#8a8aaa";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${group.events.length} \u4E8B\u4EF6`, startX + width - 8, y + 16);
      } else if (width > 40) {
        ctx.fillStyle = isHighlighted ? "#fbbf24" : "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${group.events.length}`, startX + width / 2, y + 16);
      }
    }
  }
  drawEvents() {
    if (!this.ctx)
      return;
    const { colorScheme } = this.state.options;
    for (const event of this.state.timelineEvents) {
      if (!event.visible)
        continue;
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
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(event.x, event.y, event.width, event.height);
      if (event.isRollback) {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 12px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText("\u21A9", event.x + event.width / 2, event.y + event.height / 2 + 4);
      }
      if (event.width > 60) {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "10px sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.fillText(event.userName.substring(0, 8), event.x + 5, event.y + event.height / 2 + 3);
      }
    }
  }
  drawSelection() {
    if (!this.ctx || !this.state.selectedEventId)
      return;
    const event = this.state.timelineEvents.find((e) => e.id === this.state.selectedEventId);
    if (!event)
      return;
    this.ctx.strokeStyle = this.state.options.colorScheme.selection;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(event.x - 2, event.y - 2, event.width + 4, event.height + 4);
  }
  getEvents() {
    return [...this.state.events];
  }
  getGroups() {
    return [...this.state.groups];
  }
  getSelectedEvent() {
    if (!this.state.selectedEventId)
      return null;
    return this.state.events.find((e) => e.id === this.state.selectedEventId) || null;
  }
  getState() {
    return { ...this.state };
  }
  getLogger() {
    return this.logger;
  }
  getExecutionLogs() {
    return this.logger.getLogs();
  }
  destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.canvas) {
      this.canvas.removeEventListener("wheel", this.handleWheel.bind(this));
      this.canvas.removeEventListener("mousedown", this.handleMouseDown.bind(this));
      this.canvas.removeEventListener("mousemove", this.handleMouseMove.bind(this));
      this.canvas.removeEventListener("mouseup", this.handleMouseUp.bind(this));
      this.canvas.removeEventListener("mouseleave", this.handleMouseUp.bind(this));
      this.canvas.removeEventListener("click", this.handleClick.bind(this));
    }
    this.canvas = null;
    this.ctx = null;
    this.logger.success("destroy", "Canvas \u5BA1\u8BA1\u65F6\u95F4\u8F74\u5DF2\u9500\u6BC1");
  }
};

// dist/samples/index.js
var now = Date.now();
function generateValidSampleEvents() {
  const baseTime = now - 36e5;
  const users = [
    { id: "user-001", name: "\u5F20\u4E09" },
    { id: "user-002", name: "\u674E\u56DB" },
    { id: "user-003", name: "\u738B\u4E94" },
    { id: "user-004", name: "\u8D75\u516D" }
  ];
  const resources = [
    { id: "res-001", name: "\u7528\u6237\u914D\u7F6E", type: "configuration" },
    { id: "res-002", name: "\u8BA2\u5355\u7BA1\u7406", type: "order" },
    { id: "res-003", name: "\u5546\u54C1\u4FE1\u606F", type: "product" },
    { id: "res-004", name: "\u652F\u4ED8\u8BB0\u5F55", type: "payment" }
  ];
  const events = [];
  events.push({
    id: "event-001",
    timestamp: baseTime + 1e4,
    type: "login",
    userId: "user-001",
    userName: "\u5F20\u4E09",
    resourceId: "res-001",
    resourceName: "\u7528\u6237\u914D\u7F6E",
    resourceType: "configuration",
    action: "\u767B\u5F55\u7CFB\u7EDF",
    details: "IP: 192.168.1.100",
    tags: ["\u767B\u5F55", "\u8BA4\u8BC1"]
  });
  events.push({
    id: "event-002",
    timestamp: baseTime + 2e4,
    type: "create",
    userId: "user-001",
    userName: "\u5F20\u4E09",
    resourceId: "res-002",
    resourceName: "\u8BA2\u5355\u7BA1\u7406",
    resourceType: "order",
    action: "\u521B\u5EFA\u8BA2\u5355",
    details: "\u8BA2\u5355\u53F7: ORD-2024-001",
    beforeValue: "null",
    afterValue: '{"id":"ORD-2024-001","status":"pending"}',
    tags: ["\u8BA2\u5355", "\u521B\u5EFA"]
  });
  events.push({
    id: "event-003",
    timestamp: baseTime + 3e4,
    type: "update",
    userId: "user-002",
    userName: "\u674E\u56DB",
    resourceId: "res-002",
    resourceName: "\u8BA2\u5355\u7BA1\u7406",
    resourceType: "order",
    action: "\u66F4\u65B0\u8BA2\u5355\u72B6\u6001",
    details: "\u72B6\u6001\u53D8\u66F4: pending -> processing",
    beforeValue: '{"status":"pending"}',
    afterValue: '{"status":"processing"}',
    tags: ["\u8BA2\u5355", "\u66F4\u65B0"]
  });
  events.push({
    id: "event-004",
    timestamp: baseTime + 45e3,
    type: "create",
    userId: "user-001",
    userName: "\u5F20\u4E09",
    resourceId: "res-003",
    resourceName: "\u5546\u54C1\u4FE1\u606F",
    resourceType: "product",
    action: "\u521B\u5EFA\u5546\u54C1",
    details: "\u5546\u54C1: \u6D4B\u8BD5\u5546\u54C1 A",
    beforeValue: "null",
    afterValue: '{"id":"PROD-001","name":"\u6D4B\u8BD5\u5546\u54C1","price":99.00"}',
    tags: ["\u5546\u54C1", "\u521B\u5EFA"]
  });
  events.push({
    id: "event-005",
    timestamp: baseTime + 6e4,
    type: "update",
    userId: "user-003",
    userName: "\u738B\u4E94",
    resourceId: "res-003",
    resourceName: "\u5546\u54C1\u4FE1\u606F",
    resourceType: "product",
    action: "\u4FEE\u6539\u5546\u54C1\u4EF7\u683C",
    details: "\u4EF7\u683C\u53D8\u66F4: 99.00 -> 129.00",
    beforeValue: '{"price":99.00}',
    afterValue: '{"price":129.00}',
    tags: ["\u5546\u54C1", "\u66F4\u65B0", "\u4EF7\u683C"]
  });
  events.push({
    id: "event-006",
    timestamp: baseTime + 8e4,
    type: "rollback",
    userId: "user-003",
    userName: "\u738B\u4E94",
    resourceId: "res-003",
    resourceName: "\u5546\u54C1\u4FE1\u606F",
    resourceType: "\u5546\u54C1",
    action: "\u56DE\u6EDA\u4EF7\u683C\u4FEE\u6539",
    details: "\u56DE\u6EDA\u5230\u4E4B\u524D\u7684\u4EF7\u683C",
    isRollback: true,
    rollbackTargetId: "event-005",
    tags: ["\u56DE\u6EDA", "\u4EF7\u683C"]
  });
  events.push({
    id: "event-007",
    timestamp: baseTime + 1e5,
    type: "delete",
    userId: "user-002",
    userName: "\u674E\u56DB",
    resourceId: "res-002",
    resourceName: "\u8BA2\u5355\u7BA1\u7406",
    resourceType: "order",
    action: "\u5220\u9664\u8BA2\u5355",
    details: "\u8BA2\u5355\u53F7: ORD-2024-001",
    beforeValue: '{"id":"ORD-2024-001","status":"processing"}',
    tags: ["\u8BA2\u5355", "\u5220\u9664"]
  });
  events.push({
    id: "event-008",
    timestamp: baseTime + 12e4,
    type: "update",
    userId: "user-004",
    userName: "\u8D75\u516D",
    resourceId: "res-004",
    resourceName: "\u652F\u4ED8\u8BB0\u5F55",
    resourceType: "payment",
    action: "\u66F4\u65B0\u652F\u4ED8\u72B6\u6001",
    details: "\u652F\u4ED8\u6210\u529F",
    beforeValue: '{"status":"pending"}',
    afterValue: '{"status":"success"}',
    tags: ["\u652F\u4ED8", "\u66F4\u65B0"]
  });
  events.push({
    id: "event-009",
    timestamp: baseTime + 15e4,
    type: "read",
    userId: "user-001",
    userName: "\u5F20\u4E09",
    resourceId: "res-001",
    resourceName: "\u7528\u6237\u914D\u7F6E",
    resourceType: "configuration",
    action: "\u67E5\u770B\u7528\u6237\u914D\u7F6E",
    details: "\u67E5\u770B\u4E2A\u4EBA\u8BBE\u7F6E",
    tags: ["\u914D\u7F6E", "\u67E5\u770B"]
  });
  events.push({
    id: "event-010",
    timestamp: baseTime + 18e4,
    type: "logout",
    userId: "user-001",
    userName: "\u5F20\u4E09",
    resourceId: "res-001",
    resourceName: "\u7528\u6237\u914D\u7F6E",
    resourceType: "configuration",
    action: "\u767B\u51FA\u7CFB\u7EDF",
    details: "\u6B63\u5E38\u767B\u51FA",
    tags: ["\u767B\u51FA", "\u5B89\u5168"]
  });
  return events;
}
function generateInvalidSampleEvents() {
  return [
    {
      event: {},
      reason: "\u7A7A\u5BF9\u8C61"
    },
    {
      event: {
        id: "",
        timestamp: now,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "ID \u4E3A\u7A7A\u5B57\u7B26\u4E32"
    },
    {
      event: {
        id: "event-bad-type",
        timestamp: now,
        type: "invalid_type",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u65E0\u6548\u7684\u4E8B\u4EF6\u7C7B\u578B"
    },
    {
      event: {
        id: "event-bad-timestamp",
        timestamp: -1e3,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u65E0\u6548\u7684\u65F6\u95F4\u6233\uFF08\u8D1F\u6570\uFF09"
    },
    {
      event: {
        id: "event-no-user",
        timestamp: now,
        type: "update",
        userId: "",
        userName: "",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u7528\u6237\u4FE1\u606F\u7F3A\u5931"
    },
    {
      event: {
        id: "event-no-resource",
        timestamp: now,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "",
        resourceName: "",
        resourceType: "",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u8D44\u6E90\u4FE1\u606F\u7F3A\u5931"
    },
    {
      event: {
        id: "event-rollback-no-target",
        timestamp: now,
        type: "rollback",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u56DE\u6EDA\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        isRollback: true,
        tags: []
      },
      reason: "\u56DE\u6EDA\u4E8B\u4EF6\u7F3A\u5C11\u76EE\u6807ID"
    },
    {
      event: {
        id: "event-bad-tags",
        timestamp: now,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: "invalid_tags"
      },
      reason: "\u6807\u7B7E\u4E0D\u662F\u6570\u7EC4"
    },
    {
      event: {
        id: "event-null",
        timestamp: null,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "\u6D4B\u8BD5\u64CD\u4F5C",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u65F6\u95F4\u6233\u4E3A null"
    },
    {
      event: {
        id: "event-no-action",
        timestamp: now,
        type: "update",
        userId: "user-001",
        userName: "\u6D4B\u8BD5\u7528\u6237",
        resourceId: "res-001",
        resourceName: "\u6D4B\u8BD5\u8D44\u6E90",
        resourceType: "test",
        action: "",
        details: "\u6D4B\u8BD5\u8BE6\u60C5",
        tags: []
      },
      reason: "\u64CD\u4F5C\u63CF\u8FF0\u4E3A\u7A7A"
    }
  ];
}
function generateSampleGroups() {
  return [
    {
      id: "group-001",
      name: "\u8BA2\u5355\u76F8\u5173\u64CD\u4F5C",
      color: "#3b82f6",
      events: ["event-002", "event-003", "event-007"],
      startTimestamp: now - 36e5 + 2e4,
      endTimestamp: now - 36e5 + 1e5,
      collapsed: false
    },
    {
      id: "group-002",
      name: "\u5546\u54C1\u4EF7\u683C\u8C03\u6574",
      color: "#10b981",
      events: ["event-004", "event-005", "event-006"],
      startTimestamp: now - 36e5 + 45e3,
      endTimestamp: now - 36e5 + 8e4,
      collapsed: false
    }
  ];
}
function generateEdgeCaseEvents() {
  const baseTime = now;
  return [
    {
      id: "edge-same-time-1",
      timestamp: baseTime,
      type: "update",
      userId: "user-001",
      userName: "\u7528\u6237A",
      resourceId: "res-edge-001",
      resourceName: "\u8FB9\u7F18\u8D44\u6E90",
      resourceType: "edge",
      action: "\u540C\u65F6\u53D1\u751F\u7684\u4E8B\u4EF61",
      details: "\u6D4B\u8BD5\u540C\u65F6\u4E8B\u4EF6",
      tags: ["\u8FB9\u7F18", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-same-time-2",
      timestamp: baseTime,
      type: "update",
      userId: "user-002",
      userName: "\u7528\u6237B",
      resourceId: "res-edge-001",
      resourceName: "\u8FB9\u7F18\u8D44\u6E90",
      resourceType: "edge",
      action: "\u540C\u65F6\u53D1\u751F\u7684\u4E8B\u4EF62",
      details: "\u6D4B\u8BD5\u540C\u65F6\u4E8B\u4EF6",
      tags: ["\u8FB9\u7F18", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-same-time-3",
      timestamp: baseTime,
      type: "delete",
      userId: "user-003",
      userName: "\u7528\u6237C",
      resourceId: "res-edge-002",
      resourceName: "\u53E6\u4E00\u8D44\u6E90",
      resourceType: "edge",
      action: "\u540C\u65F6\u53D1\u751F\u7684\u4E8B\u4EF63",
      details: "\u4E0D\u540C\u8D44\u6E90\u7684\u540C\u65F6\u4E8B\u4EF6",
      tags: ["\u8FB9\u7F18", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-very-old",
      timestamp: 0,
      type: "create",
      userId: "user-001",
      userName: "\u7CFB\u7EDF\u7528\u6237",
      resourceId: "res-old",
      resourceName: "\u53E4\u8001\u8D44\u6E90",
      resourceType: "historical",
      action: "\u6781\u65E9\u65F6\u95F4\u70B9\u4E8B\u4EF6",
      details: "\u65F6\u95F4\u6233\u4E3A0",
      tags: ["\u5386\u53F2", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-very-new",
      timestamp: baseTime + 31536e6,
      type: "read",
      userId: "user-001",
      userName: "\u672A\u6765\u7528\u6237",
      resourceId: "res-future",
      resourceName: "\u672A\u6765\u8D44\u6E90",
      resourceType: "future",
      action: "\u672A\u6765\u65F6\u95F4\u70B9\u4E8B\u4EF6",
      details: "\u4E00\u5E74\u540E\u7684\u4E8B\u4EF6",
      tags: ["\u672A\u6765", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-minimal-tags",
      timestamp: baseTime + 5e3,
      type: "login",
      userId: "user-001",
      userName: "\u6D4B\u8BD5\u7528\u6237",
      resourceId: "res-minimal",
      resourceName: "\u6700\u5C0F\u8D44\u6E90",
      resourceType: "minimal",
      action: "\u6700\u5C0F\u4FE1\u606F\u4E8B\u4EF6",
      details: "",
      tags: []
    },
    {
      id: "edge-long-details",
      timestamp: baseTime + 1e4,
      type: "update",
      userId: "user-001",
      userName: "\u6D4B\u8BD5\u7528\u6237",
      resourceId: "res-long",
      resourceName: "\u957F\u540D\u79F0\u8D44\u6E90\u7528\u4E8E\u6D4B\u8BD5\u663E\u793A",
      resourceType: "long_name_type_for_testing_purposes",
      action: "\u8FD9\u662F\u4E00\u4E2A\u975E\u5E38\u957F\u7684\u64CD\u4F5C\u63CF\u8FF0\u7528\u6765\u6D4B\u8BD5\u5728\u65F6\u95F4\u8F74\u4E0A\u7684\u663E\u793A\u6548\u679C",
      details: "\u8FD9\u662F\u4E00\u4E2A\u975E\u5E38\u957F\u7684\u8BE6\u60C5\u63CF\u8FF0\uFF0C\u5305\u542B\u5927\u91CF\u7684\u6587\u672C\u4FE1\u606F\uFF0C\u7528\u6765\u6D4B\u8BD5\u8BE6\u60C5\u5B57\u6BB5\u7684\u5904\u7406\u80FD\u529B\u3002Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      tags: ["\u957F\u6807\u7B7E1", "\u957F\u6807\u7B7E2", "\u957F\u6807\u7B7E3", "\u957F\u6807\u7B7E4", "\u957F\u6807\u7B7E5", "\u957F\u6807\u7B7E6", "\u957F\u6807\u7B7E7", "\u957F\u6807\u7B7E8", "\u957F\u6807\u7B7E9", "\u957F\u6807\u7B7E10"]
    },
    {
      id: "edge-null-before",
      timestamp: baseTime + 15e3,
      type: "create",
      userId: "user-001",
      userName: "\u6D4B\u8BD5\u7528\u6237",
      resourceId: "res-null",
      resourceName: "\u7A7A\u503C\u6D4B\u8BD5",
      resourceType: "null_test",
      action: "\u521B\u5EFA\u8D44\u6E90",
      details: "beforeValue \u4E3A\u7A7A\u7684\u60C5\u51B5",
      beforeValue: void 0,
      afterValue: '{"data":"test"}',
      tags: ["\u7A7A\u503C", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-null-after",
      timestamp: baseTime + 2e4,
      type: "delete",
      userId: "user-001",
      userName: "\u6D4B\u8BD5\u7528\u6237",
      resourceId: "res-null",
      resourceName: "\u7A7A\u503C\u6D4B\u8BD5",
      resourceType: "null_test",
      action: "\u5220\u9664\u8D44\u6E90",
      details: "afterValue \u4E3A\u7A7A\u7684\u60C5\u51B5",
      beforeValue: '{"data":"test"}',
      afterValue: void 0,
      tags: ["\u7A7A\u503C", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-rolled-back",
      timestamp: baseTime + 25e3,
      type: "update",
      userId: "user-001",
      userName: "\u6D4B\u8BD5\u7528\u6237",
      resourceId: "res-rolled",
      resourceName: "\u88AB\u56DE\u6EDA\u8D44\u6E90",
      resourceType: "rolled_back",
      action: "\u88AB\u56DE\u6EDA\u7684\u64CD\u4F5C",
      details: "\u8FD9\u4E2A\u64CD\u4F5C\u540E\u6765\u88AB\u56DE\u6EDA\u4E86",
      beforeValue: '{"value":"original"',
      afterValue: '{"value":"changed"',
      isRolledBack: true,
      rollbackBy: "user-002",
      tags: ["\u56DE\u6EDA", "\u6D4B\u8BD5"]
    },
    {
      id: "edge-rollback-target",
      timestamp: baseTime + 3e4,
      type: "rollback",
      userId: "user-002",
      userName: "\u7BA1\u7406\u5458",
      resourceId: "res-rolled",
      resourceName: "\u88AB\u56DE\u6EDA\u8D44\u6E90",
      resourceType: "rolled_back",
      action: "\u56DE\u6EDA\u64CD\u4F5C",
      details: "\u56DE\u6EDA\u4E4B\u524D\u7684\u4FEE\u6539",
      isRollback: true,
      rollbackTargetId: "edge-rolled-back",
      tags: ["\u56DE\u6EDA", "\u6D4B\u8BD5"]
    }
  ];
}
function generateLargeDataset(count = 100) {
  const baseTime = now - 864e5;
  const events = [];
  const types = ["create", "update", "delete", "read"];
  const users = ["user-001", "user-002", "user-003", "user-004", "user-005"];
  const userNames = ["\u5F20\u4E09", "\u674E\u56DB", "\u738B\u4E94", "\u738B\u4E94", "\u8D75\u516D", "\u94B1\u4E03", "\u5B59\u516B"];
  const resources = ["res-order", "res-product", "res-config", "res-payment", "res-user"];
  const resourceNames = ["\u8BA2\u5355\u7BA1\u7406", "\u5546\u54C1\u4FE1\u606F", "\u7CFB\u7EDF\u914D\u7F6E", "\u652F\u4ED8\u8BB0\u5F55", "\u7528\u6237\u4E2D\u5FC3"];
  const resourceTypes = ["order", "product", "config", "payment", "user"];
  const actions = ["\u521B\u5EFA\u8BB0\u5F55", "\u66F4\u65B0\u6570\u636E", "\u5220\u9664\u8BB0\u5F55", "\u67E5\u770B\u8BE6\u60C5", "\u4FEE\u6539\u72B6\u6001", "\u6279\u91CF\u64CD\u4F5C"];
  for (let i = 0; i < count; i++) {
    const userIndex = i % users.length;
    const resourceIndex = i % resources.length;
    const type = types[Math.floor(Math.random() * types.length)];
    events.push({
      id: `large-event-${String(i + 1).padStart(3, "0")}`,
      timestamp: baseTime + Math.floor(Math.random() * 864e5),
      type,
      userId: users[userIndex],
      userName: userNames[userIndex],
      resourceId: resources[resourceIndex],
      resourceName: resourceNames[resourceIndex],
      resourceType: resourceTypes[resourceIndex],
      action: actions[Math.floor(Math.random() * actions.length)],
      details: `\u8FD9\u662F\u7B2C ${i + 1} \u4E2A\u4E8B\u4EF6\u7684\u8BE6\u7EC6\u4FE1\u606F\uFF0C\u5305\u542B\u4E00\u4E9B\u968F\u673A\u7684\u63CF\u8FF0\u6587\u672C\u7528\u6765\u6D4B\u8BD5\u5927\u6570\u636E\u91CF\u4E0B\u7684\u6027\u80FD\u8868\u73B0\u3002`,
      tags: ["\u6279\u91CF", "\u6D4B\u8BD5", type]
    });
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}
export {
  CanvasAuditTimeline,
  EVENT_TYPE_COLORS,
  ExecutionLogger,
  ValidationException,
  assertValid,
  createValidationError,
  defaultTimelineOptions,
  generateEdgeCaseEvents,
  generateInvalidSampleEvents,
  generateLargeDataset,
  generateSampleGroups,
  generateValidSampleEvents,
  isNonEmptyString,
  isPositiveNumber,
  isValidTimestamp,
  validateAuditEvent,
  validateColor,
  validateEventGroup,
  validateEventId,
  validateEventType,
  validateExportOptions,
  validateResourceId,
  validateSearchOptions,
  validateTimelineOptions,
  validateTimestamp,
  validateUserId
};
//# sourceMappingURL=bundle.js.map
