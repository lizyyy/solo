package com.datarepair.approval.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.Getter;

@Getter
public enum ApprovalAction {

    SUBMIT(1, "提交"),
    APPROVE(2, "批准"),
    REJECT(3, "拒绝"),
    EXECUTE(4, "执行"),
    ROLLBACK(5, "回滚"),
    CANCEL(6, "取消"),
    RE_SUBMIT(7, "重新提交");

    @EnumValue
    private final Integer code;
    private final String desc;

    ApprovalAction(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
}
