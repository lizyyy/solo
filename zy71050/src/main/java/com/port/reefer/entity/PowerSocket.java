package com.port.reefer.entity;

import com.port.reefer.entity.enums.SocketStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "power_sockets")
public class PowerSocket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String socketCode;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SocketStatus status;

    private Long occupiedByContainerId;

    private LocalDateTime occupiedAt;

    private LocalDateTime powerOffAt;

    private String powerOffReason;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = SocketStatus.AVAILABLE;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSocketCode() { return socketCode; }
    public void setSocketCode(String socketCode) { this.socketCode = socketCode; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public SocketStatus getStatus() { return status; }
    public void setStatus(SocketStatus status) { this.status = status; }
    public Long getOccupiedByContainerId() { return occupiedByContainerId; }
    public void setOccupiedByContainerId(Long occupiedByContainerId) { this.occupiedByContainerId = occupiedByContainerId; }
    public LocalDateTime getOccupiedAt() { return occupiedAt; }
    public void setOccupiedAt(LocalDateTime occupiedAt) { this.occupiedAt = occupiedAt; }
    public LocalDateTime getPowerOffAt() { return powerOffAt; }
    public void setPowerOffAt(LocalDateTime powerOffAt) { this.powerOffAt = powerOffAt; }
    public String getPowerOffReason() { return powerOffReason; }
    public void setPowerOffReason(String powerOffReason) { this.powerOffReason = powerOffReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
