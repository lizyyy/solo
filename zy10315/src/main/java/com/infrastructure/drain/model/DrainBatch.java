package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "drain_batches", indexes = {
    @Index(name = "idx_batch_id", columnList = "batchId", unique = true),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
public class DrainBatch {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 64)
    private String batchId;
    
    @Column(nullable = false, length = 128)
    private String operator;
    
    @Column(length = 512)
    private String reason;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DrainStatus status;
    
    @Column(length = 1024)
    private String errorMessage;
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    private LocalDateTime completedAt;
    
    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ServiceInstance> instances = new ArrayList<>();
    
    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DrainActionLog> actionLogs = new ArrayList<>();
    
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
