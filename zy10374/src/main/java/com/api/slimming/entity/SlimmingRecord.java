package com.api.slimming.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("slimming_record")
public class SlimmingRecord extends BaseEntity {

    private String requestId;

    private Long ruleId;

    private String ruleNo;

    private String apiPath;

    private String sceneCode;

    private String clientIp;

    private Integer originalSize;

    private Integer slimmedSize;

    private Integer savedSize;

    private Double savedRatio;

    private LocalDateTime requestTime;

    private Boolean success;

    private String errorMessage;
}
