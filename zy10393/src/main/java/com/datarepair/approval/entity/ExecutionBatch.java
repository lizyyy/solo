package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ScriptStatus;
import com.datarepair.approval.handler.CodeEnumTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "execution_batch", autoResultMap = true)
public class ExecutionBatch extends BaseEntity {

    private Long scriptId;

    private String batchNo;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ScriptStatus batchType;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long affectedRows;

    private String executionLog;

    @TableField(typeHandler = CodeEnumTypeHandler.class)
    private ScriptStatus status;

    private String operator;

    private Boolean success;

    private String errorMessage;

    private String remark;
}
