package com.warehouse.charging.model;

import com.warehouse.charging.enums.StationStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "charging_stations")
public class ChargingStation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String stationCode;

    private String name;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StationStatus status;

    private Integer powerLevel;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = StationStatus.AVAILABLE;
        }
        if (powerLevel == null) {
            powerLevel = 100;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public StationStatus getStatus() { return status; }
    public void setStatus(StationStatus status) { this.status = status; }
    public Integer getPowerLevel() { return powerLevel; }
    public void setPowerLevel(Integer powerLevel) { this.powerLevel = powerLevel; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
