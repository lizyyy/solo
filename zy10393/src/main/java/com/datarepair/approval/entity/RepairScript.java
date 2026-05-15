package com.datarepair.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.datarepair.approval.enums.ScriptStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("repair_script")
public class RepairScript extends BaseEntity {

    private String scriptNo;

    private String scriptName;

    private String scriptType;

    private String scriptContent;

    private String rollbackScript;

    private String description;

    private String businessSystem;

    private String databaseName;

    private String estimatedImpact;

    private ScriptStatus status;

    private String currentHandler;

    private LocalDateTime submitTime;

    private LocalDateTime approvalTime;

    private LocalDateTime executeTime;

    private LocalDateTime completeTime;

    private String applicant;

    private String applicantDept;

    private String remark;

    private String requestId;
}
