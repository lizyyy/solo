package com.port.reefer.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "plugin_reports")
public class PluginReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNumber;

    @Column(nullable = false)
    private Long containerId;

    @Column(nullable = false)
    private Long socketId;

    private Long inspectorId;

    @Column(nullable = false)
    private LocalDateTime pluginTime;

    private LocalDateTime unplugTime;

    private String status;

    private Integer totalAlarms;

    private Integer resolvedAlarms;

    private String remarks;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

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
    public String getReportNumber() { return reportNumber; }
    public void setReportNumber(String reportNumber) { this.reportNumber = reportNumber; }
    public Long getContainerId() { return containerId; }
    public void setContainerId(Long containerId) { this.containerId = containerId; }
    public Long getSocketId() { return socketId; }
    public void setSocketId(Long socketId) { this.socketId = socketId; }
    public Long getInspectorId() { return inspectorId; }
    public void setInspectorId(Long inspectorId) { this.inspectorId = inspectorId; }
    public LocalDateTime getPluginTime() { return pluginTime; }
    public void setPluginTime(LocalDateTime pluginTime) { this.pluginTime = pluginTime; }
    public LocalDateTime getUnplugTime() { return unplugTime; }
    public void setUnplugTime(LocalDateTime unplugTime) { this.unplugTime = unplugTime; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getTotalAlarms() { return totalAlarms; }
    public void setTotalAlarms(Integer totalAlarms) { this.totalAlarms = totalAlarms; }
    public Integer getResolvedAlarms() { return resolvedAlarms; }
    public void setResolvedAlarms(Integer resolvedAlarms) { this.resolvedAlarms = resolvedAlarms; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
