"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSource = exports.DiscrepancyType = exports.ReviewStatus = exports.CheckInStatus = exports.RegistrationStatus = exports.ActivityType = void 0;
var ActivityType;
(function (ActivityType) {
    ActivityType["PARENT_CHILD"] = "parent_child";
    ActivityType["ELDERLY"] = "elderly";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var RegistrationStatus;
(function (RegistrationStatus) {
    RegistrationStatus["PENDING"] = "pending";
    RegistrationStatus["CONFIRMED"] = "confirmed";
    RegistrationStatus["CANCELLED"] = "cancelled";
    RegistrationStatus["WAITLIST"] = "waitlist";
    RegistrationStatus["PROMOTED"] = "promoted";
})(RegistrationStatus || (exports.RegistrationStatus = RegistrationStatus = {}));
var CheckInStatus;
(function (CheckInStatus) {
    CheckInStatus["NOT_CHECKED_IN"] = "not_checked_in";
    CheckInStatus["CHECKED_IN"] = "checked_in";
    CheckInStatus["ABSENT"] = "absent";
})(CheckInStatus || (exports.CheckInStatus = CheckInStatus = {}));
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING_REVIEW"] = "pending_review";
    ReviewStatus["APPROVED"] = "approved";
    ReviewStatus["REJECTED"] = "rejected";
    ReviewStatus["NEEDS_MORE_INFO"] = "needs_more_info";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
var DiscrepancyType;
(function (DiscrepancyType) {
    DiscrepancyType["DUPLICATE_REGISTRATION"] = "duplicate_registration";
    DiscrepancyType["BLACKLISTED"] = "blacklisted";
    DiscrepancyType["WAITLIST_PROMOTED"] = "waitlist_promoted";
    DiscrepancyType["CANCELLED_BUT_CHECKED_IN"] = "cancelled_but_checked_in";
    DiscrepancyType["NOT_REGISTERED_BUT_CHECKED_IN"] = "not_registered_but_checked_in";
    DiscrepancyType["REGISTERED_BUT_NOT_CHECKED_IN"] = "registered_but_not_checked_in";
    DiscrepancyType["INFO_MISMATCH"] = "info_mismatch";
    DiscrepancyType["MANUAL_CHANGE"] = "manual_change";
})(DiscrepancyType || (exports.DiscrepancyType = DiscrepancyType = {}));
var DataSource;
(function (DataSource) {
    DataSource["REGISTRATION_CSV"] = "registration_csv";
    DataSource["WAITLIST_JSON"] = "waitlist_json";
    DataSource["CHECKIN_CSV"] = "checkin_csv";
    DataSource["BLACKLIST_JSON"] = "blacklist_json";
    DataSource["MANUAL"] = "manual";
})(DataSource || (exports.DataSource = DataSource = {}));
