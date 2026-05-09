package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "stroke_record", indexes = {
    @Index(name = "idx_stroke_batch", columnList = "batchId", unique = true),
    @Index(name = "idx_stroke_mold_time", columnList = "moldId, recordTime"),
    @Index(name = "idx_stroke_status", columnList = "status")
})
@Data
public class StrokeRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 64)
    private String batchId;
    
    @Column(nullable = false)
    private Long moldId;
    
    @Column(nullable = false, length = 50)
    private String moldCode;
    
    @Column(nullable = false)
    private Long strokeCount;
    
    @Column(nullable = false)
    private Long accumulatedStrokes;
    
    @Column(nullable = false)
    private LocalDateTime recordTime;
    
    @Column(length = 200)
    private String productionLine;
    
    @Column(length = 200)
    private String productCode;
    
    @Column(length = 100)
    private String operator;
    
    @Column(length = 500)
    private String remark;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordStatus status;
    
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RecordSource source;
    
    @Column(nullable = false)
    private Boolean isCompensated;
    
    @Column
    private Long originalBatchId;
    
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
            status = RecordStatus.ACTIVE;
        }
        if (isCompensated == null) {
            isCompensated = false;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum RecordStatus {
        ACTIVE,
        COMPENSATED,
        REVOKED
    }
    
    public enum RecordSource {
        MACHINE,
        MANUAL,
        COMPENSATION
    }
}
