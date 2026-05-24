package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskVO {
    private Long id;
    private String taskNo;
    private String batchNo;
    private String vehicleNo;
    private String batteryNo;
    private String areaCode;
    private String vehicleLocation;
    private String locationCode;
    private String dispatcherNo;
    private String dispatcherName;
    private String riderName;
    private Integer originalBatteryLevel;
    private String status;
    private String statusDescription;
    private String statusReason;
    private String suggestion;
    private String disposeReason;
    private Boolean manualConfirmed;
    private String confirmedBy;
    private LocalDateTime confirmedAt;
    private String photoUrl;
    private LocalDateTime dispatchedAt;
    private LocalDateTime arrivedAt;
    private LocalDateTime signedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private List<OperationLogVO> operationLogs;
}
