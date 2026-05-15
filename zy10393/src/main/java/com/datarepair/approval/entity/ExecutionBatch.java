package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ScriptStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("execution_batch")
public class ExecutionBatch extends BaseEntity {

    private Long scriptId;

    private String batchNo;

    private ScriptStatus batchType;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long affectedRows;

    private String executionLog;

    private ScriptStatus status;

    private String operator;

    private Boolean success;

    private String errorMessage;

    private String remark;
}
