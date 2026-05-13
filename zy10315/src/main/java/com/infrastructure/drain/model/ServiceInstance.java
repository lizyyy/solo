package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "service_instances", indexes = {
    @Index(name = "idx_instance_id", columnList = "instanceId", unique = true),
    @Index(name = "idx_batch_id", columnList = "batch_id")
})
public class ServiceInstance {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 128)
    private String instanceId;
    
    @Column(nullable = false, length = 128)
    private String serviceName;
    
    @Column(length = 64)
    private String ip;
    
    private Integer port;
    
    @Column(length = 256)
    private String endpoint;
    
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private DrainStatus status;
    
    @Column(length = 1024)
    private String statusDetail;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private DrainBatch batch;
    
    private Integer activeConnections;
    
    private Integer pendingTasks;
    
    private LocalDateTime trafficOffloadedAt;
    
    private LocalDateTime drainedAt;
    
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
