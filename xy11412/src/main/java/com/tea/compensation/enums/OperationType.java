package com.tea.compensation.enums;

import lombok.Getter;

@Getter
public enum OperationType {
    SUBMIT("提交"),
    QUEUE("排队"),
    RETRY("重试"),
    MANUAL_TAKE_OVER("人工接管"),
    COMPENSATE("补偿入账"),
    CANCEL("取消"),
    CLOSE("关闭"),
    FREEZE("冻结"),
    UNFREEZE("解冻"),
    MODIFY_STATUS("状态变更"),
    MODIFY_CONTENT("内容修改"),
    REVOKE("撤回"),
    RESUBMIT("重新提交"),
    JUDGE("人工改判"),
    EXPORT("导出"),
    RECOVER("恢复重试");

    private final String description;

    OperationType(String description) {
        this.description = description;
    }
}
