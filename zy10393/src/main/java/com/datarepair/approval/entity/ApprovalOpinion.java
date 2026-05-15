package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ApprovalAction;
import com.datarepair.approval.handler.CodeEnumTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "approval_opinion", autoResultMap = true)
public class ApprovalOpinion extends BaseEntity {

    private Long scriptId;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ApprovalAction action;

    private String approver;

    private String approverDept;

    private String opinion;

    private Integer approvalLevel;

    private Boolean passed;

    private String remark;
}
