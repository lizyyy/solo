"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStatusTransition = exports.detectDualNameSong = exports.BOUNDARY_RULES = exports.api = exports.ConflictRecordService = void 0;
var ConflictRecordService_1 = require("./ConflictRecordService");
Object.defineProperty(exports, "ConflictRecordService", { enumerable: true, get: function () { return ConflictRecordService_1.ConflictRecordService; } });
var api_1 = require("./api");
Object.defineProperty(exports, "api", { enumerable: true, get: function () { return api_1.api; } });
__exportStar(require("./types"), exports);
var boundaryRules_1 = require("./boundaryRules");
Object.defineProperty(exports, "BOUNDARY_RULES", { enumerable: true, get: function () { return boundaryRules_1.BOUNDARY_RULES; } });
Object.defineProperty(exports, "detectDualNameSong", { enumerable: true, get: function () { return boundaryRules_1.detectDualNameSong; } });
Object.defineProperty(exports, "validateStatusTransition", { enumerable: true, get: function () { return boundaryRules_1.validateStatusTransition; } });
