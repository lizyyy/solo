package com.account.freeze.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("freeze_report")
public class FreezeReport {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String reportNo;

    private String reportType;

    private Long batchId;

    private String reportTitle;

    private String reportContent;

    private String summaryAbstract;

    private String logisticsReviewSample;

    private String operator;

    private LocalDateTime createdTime;

    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}
