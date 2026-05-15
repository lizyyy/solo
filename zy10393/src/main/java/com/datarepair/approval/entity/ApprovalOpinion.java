package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ApprovalAction;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("approval_opinion")
public class ApprovalOpinion extends BaseEntity {

    private Long scriptId;

    private ApprovalAction action;

    private String approver;

    private String approverDept;

    private String opinion;

    private Integer approvalLevel;

    private Boolean passed;

    private String remark;
}
