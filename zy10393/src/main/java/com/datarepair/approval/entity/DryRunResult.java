package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("dry_run_result")
public class DryRunResult extends BaseEntity {

    private Long scriptId;

    private String batchNo;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long affectedRows;

    private String previewData;

    private String executionLog;

    private Boolean success;

    private String errorMessage;

    private String operator;

    private String remark;
}
