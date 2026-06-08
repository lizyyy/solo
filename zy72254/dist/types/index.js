"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessStage = exports.DisplayMode = exports.ConflictResolution = exports.ObstructionStatus = void 0;
var ObstructionStatus;
(function (ObstructionStatus) {
    ObstructionStatus["PENDING_REVIEW"] = "pending_review";
    ObstructionStatus["CONFIRMED"] = "confirmed";
    ObstructionStatus["MERGED"] = "merged";
    ObstructionStatus["RESOLVED"] = "resolved";
    ObstructionStatus["DUPLICATE"] = "duplicate";
})(ObstructionStatus || (exports.ObstructionStatus = ObstructionStatus = {}));
var ConflictResolution;
(function (ConflictResolution) {
    ConflictResolution["KEEP_FIRST"] = "keep_first";
    ConflictResolution["KEEP_SECOND"] = "keep_second";
    ConflictResolution["MERGE"] = "merge";
    ConflictResolution["MANUAL"] = "manual";
})(ConflictResolution || (exports.ConflictResolution = ConflictResolution = {}));
var DisplayMode;
(function (DisplayMode) {
    DisplayMode["VIEW_3D"] = "3d";
    DisplayMode["CHART"] = "chart";
    DisplayMode["LIST"] = "list";
})(DisplayMode || (exports.DisplayMode = DisplayMode = {}));
var ProcessStage;
(function (ProcessStage) {
    ProcessStage["CAD_IMPORT"] = "cad_import";
    ProcessStage["RANGEFINDER_SUPPLEMENT"] = "rangefinder_supplement";
    ProcessStage["VIEW_3D_UPDATE"] = "view_3d_update";
    ProcessStage["COMPLETED"] = "completed";
})(ProcessStage || (exports.ProcessStage = ProcessStage = {}));
//# sourceMappingURL=index.js.map