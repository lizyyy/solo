package com.fund.refund.enums;

public enum ProcessStatus {

    PENDING("待处理", "pending"),
    IMPORTED("已导入托管确认页", "imported"),
    EVIDENCE_REVIEWED("已补看除权日截图", "evidence_reviewed"),
    DIFF_UPDATED("差异清单已更新", "diff_updated"),
    PENDING_SUPERVISOR("待结算主管复核", "pending_supervisor"),
    SUPERVISOR_APPROVED("主管已复核", "supervisor_approved"),
    NORMAL("已归正常", "normal"),
    ABNORMAL("异常", "abnormal");

    private final String desc;
    private final String code;

    ProcessStatus(String desc, String code) {
        this.desc = desc;
        this.code = code;
    }

    public String getDesc() {
        return desc;
    }

    public String getCode() {
        return code;
    }
}
