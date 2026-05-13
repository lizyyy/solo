package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("charging_stations")
public class ChargingStation {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String stationCode;
    private String stationName;
    private String location;
    private Integer maxPower;
    private String status;
    private Long currentTaskId;
    private Integer healthScore;
    private LocalDateTime lastMaintenanceTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
