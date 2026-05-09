package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "production_schedule", indexes = {
    @Index(name = "idx_schedule_line", columnList = "productionLine"),
    @Index(name = "idx_schedule_mold", columnList = "moldId"),
    @Index(name = "idx_schedule_status", columnList = "status")
})
@Data
public class ProductionSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String scheduleNo;
    
    @Column(nullable = false, length = 100)
    private String productionLine;
    
    @Column
    private Long moldId;
    
    @Column(length = 50)
    private String moldCode;
    
    @Column(nullable = false, length = 100)
    private String productCode;
    
    @Column(nullable = false)
    private Long plannedQuantity;
    
    @Column
    private Long actualQuantity;
    
    @Column(nullable = false)
    private LocalDateTime plannedStartTime;
    
    @Column(nullable = false)
    private LocalDateTime plannedEndTime;
    
    @Column
    private LocalDateTime actualStartTime;
    
    @Column
    private LocalDateTime actualEndTime;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ScheduleStatus status;
    
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ImpactStatus moldImpactStatus;
    
    @Column(length = 500)
    private String moldImpactDetail;
    
    @Column(length = 500)
    private String remark;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(length = 50)
    private String createdBy;
    
    @Column(length = 50)
    private String updatedBy;
    
    @Version
    private Long version;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ScheduleStatus.PLANNED;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum ScheduleStatus {
        PLANNED,
        READY,
        IN_PROGRESS,
        PAUSED,
        COMPLETED,
        CANCELLED,
        DELAYED
    }
    
    public enum ImpactStatus {
        NORMAL,
        WARNING,
        AT_RISK,
        NEEDS_MOLD_CHANGE
    }
}
