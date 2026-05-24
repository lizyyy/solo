package com.port.reefer.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "reefer_containers")
public class ReeferContainer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String containerNumber;

    @Column(nullable = false)
    private BigDecimal targetTemperature;

    private String vesselName;

    private String voyageNumber;

    private String destination;

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
    public String getContainerNumber() { return containerNumber; }
    public void setContainerNumber(String containerNumber) { this.containerNumber = containerNumber; }
    public BigDecimal getTargetTemperature() { return targetTemperature; }
    public void setTargetTemperature(BigDecimal targetTemperature) { this.targetTemperature = targetTemperature; }
    public String getVesselName() { return vesselName; }
    public void setVesselName(String vesselName) { this.vesselName = vesselName; }
    public String getVoyageNumber() { return voyageNumber; }
    public void setVoyageNumber(String voyageNumber) { this.voyageNumber = voyageNumber; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
