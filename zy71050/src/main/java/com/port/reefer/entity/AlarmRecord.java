package com.port.reefer.entity;

import com.port.reefer.entity.enums.AlarmStatus;
import com.port.reefer.entity.enums.AlarmType;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "alarm_records")
public class AlarmRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long containerId;

    private Long socketId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlarmType alarmType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlarmStatus status;

    private BigDecimal alarmValue;

    private BigDecimal thresholdValue;

    @Column(nullable = false)
    private LocalDateTime alarmTime;

    private LocalDateTime acknowledgedAt;

    private Long acknowledgedBy;

    private LocalDateTime resolvedAt;

    private Long resolvedBy;

    private String resolutionNotes;

    private String remarks;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = AlarmStatus.PENDING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getContainerId() { return containerId; }
    public void setContainerId(Long containerId) { this.containerId = containerId; }
    public Long getSocketId() { return socketId; }
    public void setSocketId(Long socketId) { this.socketId = socketId; }
    public AlarmType getAlarmType() { return alarmType; }
    public void setAlarmType(AlarmType alarmType) { this.alarmType = alarmType; }
    public AlarmStatus getStatus() { return status; }
    public void setStatus(AlarmStatus status) { this.status = status; }
    public BigDecimal getAlarmValue() { return alarmValue; }
    public void setAlarmValue(BigDecimal alarmValue) { this.alarmValue = alarmValue; }
    public BigDecimal getThresholdValue() { return thresholdValue; }
    public void setThresholdValue(BigDecimal thresholdValue) { this.thresholdValue = thresholdValue; }
    public LocalDateTime getAlarmTime() { return alarmTime; }
    public void setAlarmTime(LocalDateTime alarmTime) { this.alarmTime = alarmTime; }
    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }
    public Long getAcknowledgedBy() { return acknowledgedBy; }
    public void setAcknowledgedBy(Long acknowledgedBy) { this.acknowledgedBy = acknowledgedBy; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public Long getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(Long resolvedBy) { this.resolvedBy = resolvedBy; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
