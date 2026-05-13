package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("charging_tasks")
public class ChargingTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String taskCode;
    private Long batteryId;
    private Long stationId;
    private Long waveId;
    private Integer priority;
    private Boolean isUrgent;
    private Integer targetSoc;
    private Integer currentSoc;
    private LocalDateTime estimatedStartTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime estimatedEndTime;
    private LocalDateTime actualEndTime;
    private String status;
    private String assignedOperator;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
}
