package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("batteries")
public class Battery {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String batteryCode;
    private String forkliftCode;
    private String batteryType;
    private BigDecimal capacityKwh;
    private Integer currentSoc;
    private Integer minSoc;
    private String healthStatus;
    private Integer healthScore;
    private Integer cycleCount;
    private LocalDateTime lastChargeTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
