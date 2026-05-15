package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("retry_task")
public class RetryTask extends BaseEntity {
    private String taskNo;
    private Long deliveryId;
    private String deliveryNo;
    private Long nodeId;
    private String nodeCode;
    private Long versionId;
    private String versionNo;
    private Integer retryType;
    private Integer retryCount;
    private Integer maxRetry;
    private LocalDateTime nextRetryTime;
    private LocalDateTime lastRetryTime;
    private Integer status;
}
