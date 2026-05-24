package com.bus.notify.enums;

public enum RouteChangeEvent {
    SUBMIT("提交核验", "将改线信息提交核验"),
    VERIFY_PASS("核验通过", "改线信息核验通过"),
    VERIFY_REJECT("核验驳回", "改线信息核验驳回"),
    START_PROCESS("开始处理", "开始进行乘客通知处理"),
    COMPLETE_PROCESS("处理完成", "乘客通知处理完成"),
    REVIEW_PASS("复查通过", "复查确认通过"),
    REVIEW_REJECT("复查驳回", "复查发现问题，需重新处理"),
    CLOSE("结案", "改线通知流程结案"),
    CANCEL("取消", "取消改线计划");

    private final String displayName;
    private final String description;

    RouteChangeEvent(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
