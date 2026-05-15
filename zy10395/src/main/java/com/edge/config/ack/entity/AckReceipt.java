package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ack_receipt")
public class AckReceipt extends BaseEntity {
    private String receiptNo;
    private Long deliveryId;
    private String deliveryNo;
    private Long nodeId;
    private String nodeCode;
    private Long versionId;
    private String versionNo;
    private Integer ackResult;
    private LocalDateTime ackTime;
    private String ackBy;
    private String clientIp;
}
