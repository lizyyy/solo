package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("config_delivery")
public class ConfigDelivery extends BaseEntity {
    private String deliveryNo;
    private Long nodeId;
    private String nodeCode;
    private Long versionId;
    private String versionNo;
    private LocalDateTime deliveryTime;
    private Integer status;
    private LocalDateTime ackTime;
    private LocalDateTime effectiveTime;
    private Integer retryCount;
    private LocalDateTime lastRetryTime;
}
