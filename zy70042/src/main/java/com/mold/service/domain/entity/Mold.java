package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "mold", indexes = {
    @Index(name = "idx_mold_code", columnList = "moldCode", unique = true)
})
@Data
public class Mold {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String moldCode;
    
    @Column(nullable = false, length = 100)
    private String moldName;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MoldStatus status;
    
    @Column(nullable = false)
    private Long totalStrokes;
    
    @Column(nullable = false)
    private Long lifeThreshold;
    
    @Column(nullable = false)
    private Long warningThreshold;
    
    @Column(length = 200)
    private String productionLine;
    
    @Column(length = 200)
    private String currentProduct;
    
    @Column
    private LocalDateTime lastMaintenanceDate;
    
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
            status = MoldStatus.AVAILABLE;
        }
        if (totalStrokes == null) {
            totalStrokes = 0L;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    public enum MoldStatus {
        AVAILABLE,
        IN_USE,
        WARNING,
        EXPIRED,
        UNDER_MAINTENANCE,
        ARCHIVED
    }
}
