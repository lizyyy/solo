package com.edge.config.ack.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("effective_check")
public class EffectiveCheck extends BaseEntity {
    private Long deliveryId;
    private String deliveryNo;
    private Long nodeId;
    private String nodeCode;
    private Long versionId;
    private String versionNo;
    private LocalDateTime checkTime;
    private Integer checkResult;
    private String checkDetail;
    private String checkBy;
}
