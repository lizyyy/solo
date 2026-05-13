package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "queue_tasks")
public class QueueTask {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 128)
    private String taskId;
    
    @Column(nullable = false, length = 128)
    private String instanceId;
    
    @Column(length = 128)
    private String queueName;
    
    @Column(length = 256)
    private String taskType;
    
    @Column(length = 32)
    private String status;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime scheduledAt;
    
    private LocalDateTime migratedAt;
    
    @Column(length = 128)
    private String targetInstanceId;
    
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
