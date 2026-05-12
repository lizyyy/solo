"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateAssetCode = generateAssetCode;
function generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
}
function generateAssetCode(category, sequence) {
    const prefix = category.substring(0, 3).toUpperCase();
    const seqStr = String(sequence).padStart(4, '0');
    return `${prefix}-${seqStr}`;
}
//# sourceMappingURL=id.js.map