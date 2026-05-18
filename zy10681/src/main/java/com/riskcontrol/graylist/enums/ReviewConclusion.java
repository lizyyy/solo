package com.riskcontrol.graylist.enums;

public enum ReviewConclusion {
    REMOVE_FROM_LIST("解除灰名单"),
    CONTINUE_OBSERVATION("继续观察"),
    NEED_MORE_INFO("需补充材料"),
    TRANSFER_TO_MANUAL("转人工处理");

    private final String description;

    ReviewConclusion(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
