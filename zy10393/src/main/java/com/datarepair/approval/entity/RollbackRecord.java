package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("rollback_record")
public class RollbackRecord extends BaseEntity {

    private Long scriptId;

    private Long executionBatchId;

    private String batchNo;

    private String rollbackProof;

    private String rollbackScript;

    private LocalDateTime rollbackTime;

    private Long rollbackRows;

    private String rollbackLog;

    private Boolean success;

    private String operator;

    private String remark;
}
