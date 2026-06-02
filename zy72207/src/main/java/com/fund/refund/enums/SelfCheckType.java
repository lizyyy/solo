package com.fund.refund.enums;

public enum SelfCheckType {

    DUPLICATE_IMPORT("重复导入检查", "duplicate_import"),
    SPLIT_BIZ_NO("同一业务号拆分检查", "split_biz_no"),
    RECALC_AFTER_SUPPLEMENT("补录后重算检查", "recalc_after_supplement"),
    EXPORT_CONSISTENCY("导出一致性检查", "export_consistency"),
    AMOUNT_BALANCE("金额平衡检查", "amount_balance");

    private final String desc;
    private final String code;

    SelfCheckType(String desc, String code) {
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
