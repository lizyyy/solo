"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSource = exports.PatientOutcome = exports.ReviewAction = exports.ReviewResult = exports.DiscrepancyType = exports.CleaningStatus = exports.PatientStatus = exports.BedStatus = void 0;
var BedStatus;
(function (BedStatus) {
    BedStatus["OCCUPIED"] = "occupied";
    BedStatus["VACANT"] = "vacant";
    BedStatus["CLEANING"] = "cleaning";
    BedStatus["LOCKED"] = "locked";
    BedStatus["TRANSFER"] = "transfer";
})(BedStatus || (exports.BedStatus = BedStatus = {}));
var PatientStatus;
(function (PatientStatus) {
    PatientStatus["ADMITTED"] = "admitted";
    PatientStatus["TRANSFERRED"] = "transferred";
    PatientStatus["DISCHARGED"] = "discharged";
})(PatientStatus || (exports.PatientStatus = PatientStatus = {}));
var CleaningStatus;
(function (CleaningStatus) {
    CleaningStatus["PENDING"] = "pending";
    CleaningStatus["IN_PROGRESS"] = "in_progress";
    CleaningStatus["COMPLETED"] = "completed";
    CleaningStatus["OVERDUE"] = "overdue";
})(CleaningStatus || (exports.CleaningStatus = CleaningStatus = {}));
var DiscrepancyType;
(function (DiscrepancyType) {
    DiscrepancyType["STATUS_MISMATCH"] = "status_mismatch";
    DiscrepancyType["DUPLICATE_OCCUPANCY"] = "duplicate_occupancy";
    DiscrepancyType["TRANSFER_LOCK_BED"] = "transfer_lock_bed";
    DiscrepancyType["CLEANING_TIMEOUT"] = "cleaning_timeout";
    DiscrepancyType["MISSING_PATIENT"] = "missing_patient";
    DiscrepancyType["EXTRA_PATIENT"] = "extra_patient";
    DiscrepancyType["BED_NOT_CLEANED"] = "bed_not_cleaned";
    DiscrepancyType["DATA_INCONSISTENCY"] = "data_inconsistency";
})(DiscrepancyType || (exports.DiscrepancyType = DiscrepancyType = {}));
var ReviewResult;
(function (ReviewResult) {
    ReviewResult["APPROVED"] = "approved";
    ReviewResult["REJECTED"] = "rejected";
    ReviewResult["NEEDS_MORE_INFO"] = "needs_more_info";
    ReviewResult["MANUALLY_RESOLVED"] = "manually_resolved";
})(ReviewResult || (exports.ReviewResult = ReviewResult = {}));
var ReviewAction;
(function (ReviewAction) {
    ReviewAction["RELEASE"] = "release";
    ReviewAction["LOCK"] = "lock";
    ReviewAction["UPDATE_STATUS"] = "update_status";
    ReviewAction["ASSIGN_PATIENT"] = "assign_patient";
    ReviewAction["REMOVE_PATIENT"] = "remove_patient";
    ReviewAction["MARK_CLEANED"] = "mark_cleaned";
    ReviewAction["FLAG_FOR_FOLLOWUP"] = "flag_for_followup";
})(ReviewAction || (exports.ReviewAction = ReviewAction = {}));
var PatientOutcome;
(function (PatientOutcome) {
    PatientOutcome["RECOVERY_DISCHARGE"] = "recovery_discharge";
    PatientOutcome["TRANSFER_TO_OTHER_WARD"] = "transfer_to_other_ward";
    PatientOutcome["TRANSFER_TO_ICU"] = "transfer_to_icu";
    PatientOutcome["DEATH"] = "death";
    PatientOutcome["AUTOPSY"] = "autopsy";
    PatientOutcome["OTHER"] = "other";
})(PatientOutcome || (exports.PatientOutcome = PatientOutcome = {}));
var DataSource;
(function (DataSource) {
    DataSource["BED_CSV"] = "bed_csv";
    DataSource["PATIENT_JSON"] = "patient_json";
    DataSource["CLEANING_WORKORDER"] = "cleaning_workorder";
    DataSource["MANUAL_REVIEW"] = "manual_review";
})(DataSource || (exports.DataSource = DataSource = {}));
//# sourceMappingURL=index.js.map