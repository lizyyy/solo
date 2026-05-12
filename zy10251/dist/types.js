"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeSource = exports.AuthorizationStatus = exports.AppointmentStatus = void 0;
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "pending";
    AppointmentStatus["APPROVED"] = "approved";
    AppointmentStatus["REJECTED"] = "rejected";
    AppointmentStatus["CANCELLED"] = "cancelled";
    AppointmentStatus["CHECKED_IN"] = "checked_in";
    AppointmentStatus["CHECKED_OUT"] = "checked_out";
    AppointmentStatus["EXPIRED"] = "expired";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var AuthorizationStatus;
(function (AuthorizationStatus) {
    AuthorizationStatus["INACTIVE"] = "inactive";
    AuthorizationStatus["ACTIVE"] = "active";
    AuthorizationStatus["REVOKED"] = "revoked";
    AuthorizationStatus["EXPIRED"] = "expired";
})(AuthorizationStatus || (exports.AuthorizationStatus = AuthorizationStatus = {}));
var ChangeSource;
(function (ChangeSource) {
    ChangeSource["USER_CREATE"] = "user_create";
    ChangeSource["SYSTEM_AUTO"] = "system_auto";
    ChangeSource["ADMIN_APPROVE"] = "admin_approve";
    ChangeSource["ADMIN_REJECT"] = "admin_reject";
    ChangeSource["GATE_CHECKIN"] = "gate_checkin";
    ChangeSource["GATE_CHECKOUT"] = "gate_checkout";
    ChangeSource["MEETING_CANCEL"] = "meeting_cancel";
    ChangeSource["ADMIN_REVOKE"] = "admin_revoke";
    ChangeSource["SYSTEM_EXPIRE"] = "system_expire";
})(ChangeSource || (exports.ChangeSource = ChangeSource = {}));
