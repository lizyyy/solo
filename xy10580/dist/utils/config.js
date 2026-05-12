"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.getAppealDir = getAppealDir;
exports.getDataDir = getDataDir;
exports.getReportsDir = getReportsDir;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const DEFAULT_APPEAL_DIR = path_1.default.join(os_1.default.homedir(), '.rider-appeal');
function getAppealDir() {
    const customDir = process.env.APPEAL_DIR;
    const appealDir = customDir || DEFAULT_APPEAL_DIR;
    if (!fs_1.default.existsSync(appealDir)) {
        fs_1.default.mkdirSync(appealDir, { recursive: true });
    }
    return appealDir;
}
function getDataDir() {
    const dataDir = path_1.default.join(getAppealDir(), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}
function getReportsDir() {
    const reportsDir = path_1.default.join(getAppealDir(), 'reports');
    if (!fs_1.default.existsSync(reportsDir)) {
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
    }
    return reportsDir;
}
exports.CONFIG = {
    MERCHANT_PREPARE_TIMEOUT_THRESHOLD: 15 * 60 * 1000,
    WEATHER_AFFECTED_WINDOW_BEFORE: 30 * 60 * 1000,
    WEATHER_AFFECTED_WINDOW_AFTER: 30 * 60 * 1000,
    TRAJECTORY_GAP_THRESHOLD: 5 * 60 * 1000,
    MAX_ALLOWED_DELAY_RATIO: 1.5,
    MIN_TRAJECTORY_POINTS: 5,
    APPEAL_TYPES: ['timeout', 'bad_review', 'cancellation'],
    WEATHER_TYPES: ['sunny', 'rain', 'heavy_rain', 'storm', 'fog', 'snow'],
    BAD_WEATHER_TYPES: ['heavy_rain', 'storm', 'heavy_snow'],
};
//# sourceMappingURL=config.js.map