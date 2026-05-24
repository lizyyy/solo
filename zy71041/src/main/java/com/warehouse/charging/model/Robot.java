package com.warehouse.charging.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "robots")
public class Robot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String robotCode;

    private String name;

    @Column(nullable = false)
    private Integer currentBattery;

    private Integer batteryCapacity;

    private String currentTask;

    private String location;

    private Boolean isOnline;

    private LocalDateTime lastHeartbeat;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (batteryCapacity == null) {
            batteryCapacity = 100;
        }
        if (isOnline == null) {
            isOnline = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRobotCode() { return robotCode; }
    public void setRobotCode(String robotCode) { this.robotCode = robotCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getCurrentBattery() { return currentBattery; }
    public void setCurrentBattery(Integer currentBattery) { this.currentBattery = currentBattery; }
    public Integer getBatteryCapacity() { return batteryCapacity; }
    public void setBatteryCapacity(Integer batteryCapacity) { this.batteryCapacity = batteryCapacity; }
    public String getCurrentTask() { return currentTask; }
    public void setCurrentTask(String currentTask) { this.currentTask = currentTask; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public Boolean getIsOnline() { return isOnline; }
    public void setIsOnline(Boolean isOnline) { this.isOnline = isOnline; }
    public LocalDateTime getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(LocalDateTime lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
