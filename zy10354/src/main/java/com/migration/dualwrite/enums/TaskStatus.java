package com.migration.dualwrite.enums;

import lombok.Getter;

@Getter
public enum TaskStatus {
    CREATED("CREATED", "已创建"),
    VALIDATING("VALIDATING", "校验中"),
    VALIDATED("VALIDATED", "校验通过"),
    DUAL_WRITING("DUAL_WRITING", "双写执行中"),
    DUAL_WRITE_COMPLETED("DUAL_WRITE_COMPLETED", "双写完成"),
    COMPARING("COMPARING", "比对中"),
    COMPARE_COMPLETED("COMPARE_COMPLETED", "比对完成"),
    SWITCH_READY("SWITCH_READY", "可切换"),
    SWITCHED("SWITCHED", "已切换"),
    ROLLBACKED("ROLLBACKED", "已回滚"),
    FAILED("FAILED", "失败");

    private final String code;
    private final String desc;

    TaskStatus(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
