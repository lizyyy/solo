"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictType = exports.BatchStatus = exports.DataSource = exports.TicketType = void 0;
var TicketType;
(function (TicketType) {
    TicketType["PAID"] = "paid";
    TicketType["COMP"] = "complimentary";
})(TicketType || (exports.TicketType = TicketType = {}));
var DataSource;
(function (DataSource) {
    DataSource["SOUND_ENGINEER"] = "sound_engineer";
    DataSource["REHEARSAL_GROUP"] = "rehearsal_group";
})(DataSource || (exports.DataSource = DataSource = {}));
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["DRAFT"] = "draft";
    BatchStatus["PENDING_REVIEW"] = "pending_review";
    BatchStatus["CONFIRMED"] = "confirmed";
    BatchStatus["REJECTED"] = "rejected";
    BatchStatus["NEEDS_AUDIO_ENGINEER_REVIEW"] = "needs_audio_engineer_review";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
var ConflictType;
(function (ConflictType) {
    ConflictType["TICKET_COUNT_MISMATCH"] = "ticket_count_mismatch";
    ConflictType["TICKET_TYPE_MISMATCH"] = "ticket_type_mismatch";
    ConflictType["ATTENDEE_MISMATCH"] = "attendee_mismatch";
    ConflictType["REVENUE_MISMATCH"] = "revenue_mismatch";
})(ConflictType || (exports.ConflictType = ConflictType = {}));
