package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ApprovalAction;
import com.datarepair.approval.enums.ScriptStatus;
import com.datarepair.approval.handler.CodeEnumTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "timeline_record", autoResultMap = true)
public class TimelineRecord extends BaseEntity {

    private Long scriptId;

    private Long batchId;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ApprovalAction action;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ScriptStatus fromStatus;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ScriptStatus toStatus;

    private String operator;

    private String operatorDept;

    private LocalDateTime actionTime;

    private String remark;

    private String detail;
}
