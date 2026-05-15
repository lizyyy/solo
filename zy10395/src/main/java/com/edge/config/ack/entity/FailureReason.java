package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("failure_reason")
public class FailureReason extends BaseEntity {
    private Long deliveryId;
    private String deliveryNo;
    private Long nodeId;
    private String nodeCode;
    private Long versionId;
    private String versionNo;
    private Integer failureType;
    private String failureCode;
    private String failureMsg;
    private String failureDetail;
    private LocalDateTime failureTime;
}
