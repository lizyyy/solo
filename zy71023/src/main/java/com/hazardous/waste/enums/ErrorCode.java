package com.hazardous.waste.enums;

public enum ErrorCode {
    MISSING_MATERIAL(400, "缺少必要材料"),
    INVALID_STATUS(409, "当前状态不允许此操作"),
    DUPLICATE_REQUEST(409, "重复请求"),
    NEEDS_REVIEW(422, "需要人工复核"),
    CATEGORY_MISMATCH(400, "危废类别不匹配"),
    OVERDUE_STORAGE(409, "危废已超期暂存"),
    TRANSFER_FORM_USED(409, "转运单已被使用"),
    BUCKET_MIXED(400, "暂存桶类别混装"),
    INVALID_CATEGORY(400, "无效的危废类别"),
    NOT_FOUND(404, "记录不存在");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
