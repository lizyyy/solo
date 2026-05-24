package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.validation.constraints.NotBlank;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTaskRequest {
    private String batchNo;

    @NotBlank(message = "车辆编号不能为空")
    private String vehicleNo;

    @NotBlank(message = "电池编号不能为空")
    private String batteryNo;

    @NotBlank(message = "片区不能为空")
    private String areaCode;

    private String vehicleLocation;

    private String locationCode;

    private String dispatcherNo;

    private String riderName;

    private Integer originalBatteryLevel;

    private String rawInput;
}
