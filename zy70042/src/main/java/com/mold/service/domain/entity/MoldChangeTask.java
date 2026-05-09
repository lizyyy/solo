package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "mold_change_task", indexes = {
    @Index(name = "idx_task_mold", columnList = "moldId"),
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_task_line", columnList = "productionLine")
})
@Data
public class MoldChangeTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String taskNo;
    
    @Column(nullable = false)
    private Long moldId;
    
    @Column(nullable = false, length = 50)
    private String moldCode;
    
    @Column(length = 100)
    private String moldName;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TaskType taskType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TaskStatus status;
    
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private TaskPriority priority;
    
    @Column(nullable = false)
    private Long triggeredStrokes;
    
    @Column(nullable = false)
    private Long lifeThreshold;
    
    @Column(length = 200)
    private String productionLine;
    
    @Column(length = 200)
    private String currentProduct;
    
    @Column(length = 200)
    private String nextProduct;
    
    @Column
    private LocalDateTime expectedCompleteTime;
    
    @Column
    private LocalDateTime actualStartTime;
    
    @Column
    private LocalDateTime actualCompleteTime;
    
    @Column(length = 100)
    private String operator;
    
    @Column(length = 500)
    private String remark;
    
    @Column
    private Long relatedStrokeRecordId;
    
    @Column
    private Long relatedScheduleId;
    
    @Column(length = 200)
    private String scheduleImpact;
    
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
            status = TaskStatus.PENDING;
        }
        if (priority == null) {
            priority = TaskPriority.NORMAL;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum TaskType {
        LIFE_EXPIRED,
        WARNING_PREVENTIVE,
        SCHEDULE_PLANNED,
        EMERGENCY,
        EXTENSION_APPROVED
    }
    
    public enum TaskStatus {
        PENDING,
        ASSIGNED,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED,
        DELAYED
    }
    
    public enum TaskPriority {
        LOW,
        NORMAL,
        HIGH,
        URGENT
    }
}
