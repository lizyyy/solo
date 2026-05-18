package com.riskcontrol.graylist.enums;

public enum GraylistStatus {
    IN_GRAYLIST("灰名单中"),
    REVIEW_PENDING("复核待办"),
    REMOVED("已解除"),
    UNDER_OBSERVATION("继续观察");

    private final String description;

    GraylistStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
