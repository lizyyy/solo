package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ApprovalAction;
import com.datarepair.approval.enums.ScriptStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("timeline_record")
public class TimelineRecord extends BaseEntity {

    private Long scriptId;

    private Long batchId;

    private ApprovalAction action;

    private ScriptStatus fromStatus;

    private ScriptStatus toStatus;

    private String operator;

    private String operatorDept;

    private LocalDateTime actionTime;

    private String remark;

    private String detail;
}
