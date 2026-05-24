package com.hospital.oxygen.entity;

import com.hospital.oxygen.enums.PortStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "oxygen_ports")
public class OxygenPort {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String portCode;

    @Column(nullable = false)
    private String ward;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PortStatus status = PortStatus.AVAILABLE;

    private String currentBookingId;

    private Boolean isActive = true;

    private LocalDateTime createdAt;
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
    public String getPortCode() { return portCode; }
    public void setPortCode(String portCode) { this.portCode = portCode; }
    public String getWard() { return ward; }
    public void setWard(String ward) { this.ward = ward; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public PortStatus getStatus() { return status; }
    public void setStatus(PortStatus status) { this.status = status; }
    public String getCurrentBookingId() { return currentBookingId; }
    public void setCurrentBookingId(String currentBookingId) { this.currentBookingId = currentBookingId; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
