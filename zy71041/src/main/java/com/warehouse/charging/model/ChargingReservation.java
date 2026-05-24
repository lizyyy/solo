package com.warehouse.charging.model;

import com.warehouse.charging.enums.ReservationStatus;
import com.warehouse.charging.enums.TaskPriority;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "charging_reservations")
public class ChargingReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String requestId;

    @Column(nullable = false)
    private String robotCode;

    @Column(nullable = false)
    private String stationCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPriority priority;

    @Column(nullable = false)
    private Integer batteryLevel;

    private String currentTask;

    private LocalDateTime estimatedChargingStartTime;

    private LocalDateTime estimatedChargingEndTime;

    private LocalDateTime actualStartTime;

    private LocalDateTime actualEndTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status;

    @Enumerated(EnumType.STRING)
    private ReservationStatus previousStatus;

    @Column(length = 1000)
    private String decisionReason;

    @Column(length = 1000)
    private String ruleApplied;

    private Long preemptedByReservationId;

    private String createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
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
    public LocalDateTime getEstimatedChargingStartTime() { return estimatedChargingStartTime; }
    public void setEstimatedChargingStartTime(LocalDateTime estimatedChargingStartTime) { this.estimatedChargingStartTime = estimatedChargingStartTime; }
    public LocalDateTime getEstimatedChargingEndTime() { return estimatedChargingEndTime; }
    public void setEstimatedChargingEndTime(LocalDateTime estimatedChargingEndTime) { this.estimatedChargingEndTime = estimatedChargingEndTime; }
    public LocalDateTime getActualStartTime() { return actualStartTime; }
    public void setActualStartTime(LocalDateTime actualStartTime) { this.actualStartTime = actualStartTime; }
    public LocalDateTime getActualEndTime() { return actualEndTime; }
    public void setActualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; }
    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }
    public ReservationStatus getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(ReservationStatus previousStatus) { this.previousStatus = previousStatus; }
    public String getDecisionReason() { return decisionReason; }
    public void setDecisionReason(String decisionReason) { this.decisionReason = decisionReason; }
    public String getRuleApplied() { return ruleApplied; }
    public void setRuleApplied(String ruleApplied) { this.ruleApplied = ruleApplied; }
    public Long getPreemptedByReservationId() { return preemptedByReservationId; }
    public void setPreemptedByReservationId(Long preemptedByReservationId) { this.preemptedByReservationId = preemptedByReservationId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
