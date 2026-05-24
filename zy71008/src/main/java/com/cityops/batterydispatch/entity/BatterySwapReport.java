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
@Table(name = "battery_swap_reports")
public class BatterySwapReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String reportNo;

    @Column(nullable = false, length = 50)
    private String taskNo;

    @Column(nullable = false, length = 50)
    private String vehicleNo;

    @Column(nullable = false, length = 50)
    private String oldBatteryNo;

    @Column(nullable = false, length = 50)
    private String newBatteryNo;

    @Column(length = 50)
    private String areaCode;

    @Column(length = 50)
    private String dispatcherNo;

    @Column(length = 100)
    private String dispatcherName;

    @Column(length = 100)
    private String riderName;

    private Integer oldBatteryLevel;

    private Integer newBatteryLevel;

    @Column(length = 500)
    private String location;

    @Column(length = 500)
    private String photoUrl;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DispatchStatus finalStatus;

    @Column(length = 500)
    private String disposeReason;

    @Column(length = 1000)
    private String remarks;

    private LocalDateTime swapTime;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
