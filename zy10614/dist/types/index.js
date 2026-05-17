"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeAction = exports.SourceChannel = exports.CandidateStatus = void 0;
var CandidateStatus;
(function (CandidateStatus) {
    CandidateStatus["PENDING_MERGE"] = "pending_merge";
    CandidateStatus["CONFLICT_REVIEW"] = "conflict_review";
    CandidateStatus["MERGED"] = "merged";
    CandidateStatus["KEEP_INDEPENDENT"] = "keep_independent";
})(CandidateStatus || (exports.CandidateStatus = CandidateStatus = {}));
var SourceChannel;
(function (SourceChannel) {
    SourceChannel["HEADHUNTER"] = "headhunter";
    SourceChannel["OFFICIAL_WEBSITE"] = "official_website";
    SourceChannel["INTERNAL_RECOMMENDATION"] = "internal_recommendation";
    SourceChannel["ZHAOPIN"] = "zhaopin";
    SourceChannel["LIEPIN"] = "liepin";
    SourceChannel["BOSS"] = "boss";
    SourceChannel["OTHER"] = "other";
})(SourceChannel || (exports.SourceChannel = SourceChannel = {}));
var MergeAction;
(function (MergeAction) {
    MergeAction["MERGE"] = "merge";
    MergeAction["KEEP_INDEPENDENT"] = "keep_independent";
    MergeAction["WITHDRAW"] = "withdraw";
})(MergeAction || (exports.MergeAction = MergeAction = {}));
