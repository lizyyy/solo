package com.port.reefer.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "temperature_samples")
public class TemperatureSample {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long containerId;

    private Long socketId;

    @Column(nullable = false)
    private BigDecimal temperature;

    private BigDecimal setPoint;

    private BigDecimal ambientTemperature;

    @Column(nullable = false)
    private LocalDateTime sampleTime;

    private Long inspectorId;

    private String remarks;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getContainerId() { return containerId; }
    public void setContainerId(Long containerId) { this.containerId = containerId; }
    public Long getSocketId() { return socketId; }
    public void setSocketId(Long socketId) { this.socketId = socketId; }
    public BigDecimal getTemperature() { return temperature; }
    public void setTemperature(BigDecimal temperature) { this.temperature = temperature; }
    public BigDecimal getSetPoint() { return setPoint; }
    public void setSetPoint(BigDecimal setPoint) { this.setPoint = setPoint; }
    public BigDecimal getAmbientTemperature() { return ambientTemperature; }
    public void setAmbientTemperature(BigDecimal ambientTemperature) { this.ambientTemperature = ambientTemperature; }
    public LocalDateTime getSampleTime() { return sampleTime; }
    public void setSampleTime(LocalDateTime sampleTime) { this.sampleTime = sampleTime; }
    public Long getInspectorId() { return inspectorId; }
    public void setInspectorId(Long inspectorId) { this.inspectorId = inspectorId; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
