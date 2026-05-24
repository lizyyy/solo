"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BounceCategoryLabels = exports.BounceCategory = void 0;
var BounceCategory;
(function (BounceCategory) {
    BounceCategory["MAILBOX_NOT_EXIST"] = "mailbox_not_exist";
    BounceCategory["POLICY_REJECTION"] = "policy_rejection";
    BounceCategory["CONTENT_BLOCKED"] = "content_blocked";
    BounceCategory["TEMPORARY_FAILURE"] = "temporary_failure";
    BounceCategory["UNKNOWN"] = "unknown";
})(BounceCategory || (exports.BounceCategory = BounceCategory = {}));
exports.BounceCategoryLabels = {
    [BounceCategory.MAILBOX_NOT_EXIST]: '邮箱不存在',
    [BounceCategory.POLICY_REJECTION]: '策略拒收',
    [BounceCategory.CONTENT_BLOCKED]: '内容被拦',
    [BounceCategory.TEMPORARY_FAILURE]: '临时失败',
    [BounceCategory.UNKNOWN]: '未知原因'
};
//# sourceMappingURL=types.js.map