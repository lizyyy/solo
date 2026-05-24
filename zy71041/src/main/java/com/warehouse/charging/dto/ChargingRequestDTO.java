package com.warehouse.charging.dto;

import com.warehouse.charging.enums.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ChargingRequestDTO {
    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "机器人编码不能为空")
    private String robotCode;

    private String stationCode;

    @NotNull(message = "优先级不能为空")
    private TaskPriority priority;

    @NotNull(message = "电量不能为空")
    private Integer batteryLevel;

    private String currentTask;

    private String operator;

    private String evidence;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getRobotCode() { return robotCode; }
    public void setRobotCode(String robotCode) { this.robotCode = robotCode; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
    public Integer getBatteryLevel() { return batteryLevel; }
    public void setBatteryLevel(Integer batteryLevel) { this.batteryLevel = batteryLevel; }
    public String getCurrentTask() { return currentTask; }
    public void setCurrentTask(String currentTask) { this.currentTask = currentTask; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
}
