package com.cityops.batterydispatch.entity;

import com.cityops.batterydispatch.enums.DispatchStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "dispatch_tasks")
public class DispatchTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String taskNo;

    @Column(length = 50)
    private String batchNo;

    @Column(nullable = false, length = 50)
    private String vehicleNo;

    @Column(nullable = false, length = 50)
    private String batteryNo;

    @Column(nullable = false, length = 50)
    private String areaCode;

    @Column(length = 200)
    private String vehicleLocation;

    @Column(length = 50)
    private String locationCode;

    @Column(length = 50)
    private String dispatcherNo;

    @Column(length = 100)
    private String dispatcherName;

    @Column(length = 100)
    private String riderName;

    private Integer originalBatteryLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DispatchStatus status;

    @Column(length = 500)
    private String statusReason;

    @Column(length = 1000)
    private String rawInput;

    private String suggestion;

    private String reviewRemark;

    private String photoUrl;

    private String photoChecksum;

    private LocalDateTime dispatchedAt;

    private LocalDateTime arrivedAt;

    private LocalDateTime signedAt;

    private LocalDateTime completedAt;

    private LocalDateTime cancelledAt;

    @Column(nullable = false)
    private Boolean manualConfirmed = false;

    @Column(length = 50)
    private String confirmedBy;

    private LocalDateTime confirmedAt;

    @Column(length = 500)
    private String disposeReason;

    @Column(nullable = false)
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
}
