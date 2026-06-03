package com.xxx.financial.enums;

public enum ApproverType {
    FULL_NAME("完整中文名"),
    PINYIN_ONLY("仅拼音"),
    EMPTY("未填写");

    private final String description;

    ApproverType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
