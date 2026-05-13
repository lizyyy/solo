const VALID_EVENT_TYPES = [
    'create', 'update', 'delete', 'rollback', 'restore', 'read', 'login', 'logout'
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function createValidationError(field, message, value) {
    return { field, message, value };
}
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
export function isPositiveNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export function isValidTimestamp(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
export function validateEventId(id, fieldName = 'id') {
    if (!isNonEmptyString(id)) {
        return createValidationError(fieldName, 'ID 必须是非空字符串', id);
    }
    return null;
}
export function validateUserId(userId) {
    if (!isNonEmptyString(userId)) {
        return createValidationError('userId', '用户ID 必须是非空字符串', userId);
    }
    return null;
}
export function validateTimestamp(timestamp) {
    if (!isValidTimestamp(timestamp)) {
        return createValidationError('timestamp', '时间戳必须是有效的非负数字', timestamp);
    }
    return null;
}
export function validateEventType(type) {
    if (!VALID_EVENT_TYPES.includes(type)) {
        return createValidationError('type', `事件类型必须是以下之一: ${VALID_EVENT_TYPES.join(', ')}`, type);
    }
    return null;
}
export function validateResourceId(resourceId) {
    if (!isNonEmptyString(resourceId)) {
        return createValidationError('resourceId', '资源ID 必须是非空字符串', resourceId);
    }
    return null;
}
export function validateColor(color, fieldName = 'color') {
    if (!isNonEmptyString(color) || !HEX_COLOR_REGEX.test(color)) {
        return createValidationError(fieldName, '颜色必须是有效的 HEX 格式 (#xxx 或 #xxxxxx)', color);
    }
    return null;
}
export function validateAuditEvent(event, existingEvents) {
    const errors = [];
    if (event === null || event === undefined) {
        return { valid: false, errors: [createValidationError('event', '审计事件不能为空')] };
    }
    const e = event;
    const idError = validateEventId(e.id || '');
    if (idError)
        errors.push(idError);
    const timestampError = validateTimestamp(e.timestamp ?? -1);
    if (timestampError)
        errors.push(timestampError);
    const typeError = validateEventType(e.type || '');
    if (typeError)
        errors.push(typeError);
    const userIdError = validateUserId(e.userId || '');
    if (userIdError)
        errors.push(userIdError);
    if (!isNonEmptyString(e.userName)) {
        errors.push(createValidationError('userName', '用户名必须是非空字符串', e.userName));
    }
    const resourceIdError = validateResourceId(e.resourceId || '');
    if (resourceIdError)
        errors.push(resourceIdError);
    if (!isNonEmptyString(e.resourceName)) {
        errors.push(createValidationError('resourceName', '资源名称必须是非空字符串', e.resourceName));
    }
    if (!isNonEmptyString(e.resourceType)) {
        errors.push(createValidationError('resourceType', '资源类型必须是非空字符串', e.resourceType));
    }
    if (!isNonEmptyString(e.action)) {
        errors.push(createValidationError('action', '操作描述必须是非空字符串', e.action));
    }
    if (e.tags !== undefined && !Array.isArray(e.tags)) {
        errors.push(createValidationError('tags', '标签必须是数组', e.tags));
    }
    else if (Array.isArray(e.tags) && !e.tags.every(tag => typeof tag === 'string')) {
        errors.push(createValidationError('tags', '所有标签必须是字符串', e.tags));
    }
    if (e.isRollback && !isNonEmptyString(e.rollbackTargetId)) {
        errors.push(createValidationError('rollbackTargetId', '回滚事件必须指定目标事件ID', e.rollbackTargetId));
    }
    if (e.rollbackTargetId) {
        if (existingEvents) {
            const targetExists = existingEvents.some(ev => ev.id === e.rollbackTargetId);
            if (!targetExists) {
                errors.push(createValidationError('rollbackTargetId', '回滚目标事件ID不存在', e.rollbackTargetId));
            }
        }
    }
    if (existingEvents && e.id) {
        const duplicate = existingEvents.some(ev => ev.id === e.id);
        if (duplicate) {
            errors.push(createValidationError('id', '事件ID已存在', e.id));
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export function validateEventGroup(group, existingEvents) {
    const errors = [];
    if (group === null || group === undefined) {
        return { valid: false, errors: [createValidationError('group', '事件组不能为空')] };
    }
    const g = group;
    if (!isNonEmptyString(g.id)) {
        errors.push(createValidationError('id', '组ID必须是非空字符串', g.id));
    }
    if (!isNonEmptyString(g.name)) {
        errors.push(createValidationError('name', '组名称必须是非空字符串', g.name));
    }
    const colorError = validateColor(g.color || '');
    if (colorError)
        errors.push(colorError);
    if (!Array.isArray(g.events)) {
        errors.push(createValidationError('events', '事件列表必须是数组', g.events));
    }
    else {
        for (const eventId of g.events) {
            const idError = validateEventId(eventId);
            if (idError)
                errors.push(idError);
            if (existingEvents) {
                const eventExists = existingEvents.some(ev => ev.id === eventId);
                if (!eventExists) {
                    errors.push(createValidationError('events', `事件ID不存在: ${eventId}`, eventId));
                }
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export function validateTimelineOptions(options) {
    const errors = [];
    if (options === null || options === undefined) {
        return { valid: false, errors: [createValidationError('options', '配置选项不能为空')] };
    }
    const o = options;
    if (o.canvasWidth !== undefined && !isPositiveNumber(o.canvasWidth)) {
        errors.push(createValidationError('canvasWidth', '画布宽度必须是正数', o.canvasWidth));
    }
    if (o.canvasHeight !== undefined && !isPositiveNumber(o.canvasHeight)) {
        errors.push(createValidationError('canvasHeight', '画布高度必须是正数', o.canvasHeight));
    }
    if (o.minZoom !== undefined && !isPositiveNumber(o.minZoom)) {
        errors.push(createValidationError('minZoom', '最小缩放级别必须是正数', o.minZoom));
    }
    if (o.maxZoom !== undefined && !isPositiveNumber(o.maxZoom)) {
        errors.push(createValidationError('maxZoom', '最大缩放级别必须是正数', o.maxZoom));
    }
    if (o.minZoom !== undefined && o.maxZoom !== undefined && o.minZoom >= o.maxZoom) {
        errors.push(createValidationError('maxZoom', '最大缩放级别必须大于最小缩放级别', o.maxZoom));
    }
    if (o.initialZoom !== undefined) {
        const min = o.minZoom ?? 0.1;
        const max = o.maxZoom ?? 10;
        if (!isPositiveNumber(o.initialZoom) || o.initialZoom < min || o.initialZoom > max) {
            errors.push(createValidationError('initialZoom', `初始缩放级别必须在 [${min}, ${max}] 范围内`, o.initialZoom));
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export function validateSearchOptions(options) {
    const errors = [];
    if (options === null || options === undefined) {
        return { valid: false, errors: [createValidationError('options', '搜索选项不能为空')] };
    }
    const o = options;
    if (o.query === undefined || o.query === null) {
        errors.push(createValidationError('query', '搜索查询不能为空'));
    }
    const validSearchFields = [
        'action', 'details', 'userName', 'resourceName', 'resourceType', 'tags'
    ];
    if (o.searchIn !== undefined) {
        if (!Array.isArray(o.searchIn)) {
            errors.push(createValidationError('searchIn', '搜索字段必须是数组', o.searchIn));
        }
        else {
            for (const field of o.searchIn) {
                if (!validSearchFields.includes(field)) {
                    errors.push(createValidationError('searchIn', `无效的搜索字段: ${field}`, field));
                }
            }
        }
    }
    if (o.caseSensitive !== undefined && typeof o.caseSensitive !== 'boolean') {
        errors.push(createValidationError('caseSensitive', 'caseSensitive 必须是布尔值', o.caseSensitive));
    }
    if (o.exactMatch !== undefined && typeof o.exactMatch !== 'boolean') {
        errors.push(createValidationError('exactMatch', 'exactMatch 必须是布尔值', o.exactMatch));
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export function validateExportOptions(options) {
    const errors = [];
    if (options === null || options === undefined) {
        return { valid: false, errors: [createValidationError('options', '导出选项不能为空')] };
    }
    const o = options;
    if (o.format !== undefined && !['png', 'jpeg'].includes(o.format)) {
        errors.push(createValidationError('format', '格式必须是 png 或 jpeg', o.format));
    }
    if (o.quality !== undefined) {
        if (typeof o.quality !== 'number' || o.quality < 0 || o.quality > 1) {
            errors.push(createValidationError('quality', '质量必须是 0 到 1 之间的数字', o.quality));
        }
    }
    if (o.backgroundColor !== undefined) {
        const colorError = validateColor(o.backgroundColor, 'backgroundColor');
        if (colorError)
            errors.push(colorError);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
export class ValidationException extends Error {
    constructor(message, errors) {
        super(message);
        this.name = 'ValidationException';
        this.errors = errors;
    }
}
export function assertValid(result, message = '验证失败') {
    if (!result.valid) {
        throw new ValidationException(message, result.errors);
    }
}
//# sourceMappingURL=index.js.map