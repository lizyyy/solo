"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileHash = exports.generateTaskId = exports.generateSourceId = exports.generateSupplementFactId = exports.generatePriceFactId = exports.generateWasteFactId = exports.generateOrderFactId = exports.generateFactId = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateFactId = (sourceType, businessKey) => {
    const hash = crypto_1.default.createHash('sha256');
    hash.update(`${sourceType}:${businessKey}`);
    return hash.digest('hex').slice(0, 32);
};
exports.generateFactId = generateFactId;
const generateOrderFactId = (orderNo, materialCode) => {
    return (0, exports.generateFactId)('order', `${orderNo}:${materialCode}`);
};
exports.generateOrderFactId = generateOrderFactId;
const generateWasteFactId = (wasteNo, materialCode) => {
    return (0, exports.generateFactId)('waste', `${wasteNo}:${materialCode}`);
};
exports.generateWasteFactId = generateWasteFactId;
const generatePriceFactId = (materialCode, effectiveDate) => {
    return (0, exports.generateFactId)('price', `${materialCode}:${effectiveDate}`);
};
exports.generatePriceFactId = generatePriceFactId;
const generateSupplementFactId = (supplementNo, materialCode) => {
    return (0, exports.generateFactId)('supplement', `${supplementNo}:${materialCode}`);
};
exports.generateSupplementFactId = generateSupplementFactId;
const generateSourceId = (fileName, fileHash) => {
    const hash = crypto_1.default.createHash('sha256');
    hash.update(`${fileName}:${fileHash}`);
    return `src_${hash.digest('hex').slice(0, 24)}`;
};
exports.generateSourceId = generateSourceId;
const generateTaskId = () => {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
exports.generateTaskId = generateTaskId;
const generateFileHash = (content) => {
    return crypto_1.default.createHash('md5').update(content).digest('hex');
};
exports.generateFileHash = generateFileHash;
