package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "evidence_chain", autoResultMap = true)
public class EvidenceChain {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String chainNo;

    private Long batchId;

    private Long batchItemId;

    private String accountNo;

    private String status;

    private String breakReason;

    private Integer smsEvidence;

    private String smsScreenshotUrl;

    private Integer logisticsEvidence;

    private String logisticsScreenshotUrl;

    private Integer logisticsScreenshotReviewed;

    private String reviewOperator;

    private LocalDateTime reviewTime;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> extraEvidence;

    private String operator;

    private String remark;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
