package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "recovery_actions")
public class RecoveryAction {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 64)
    private String batchId;
    
    @Column(length = 128)
    private String instanceId;
    
    @Column(nullable = false, length = 128)
    private String operator;
    
    @Column(nullable = false, length = 64)
    private String actionType;
    
    @Column(length = 1024)
    private String reason;
    
    @Column(length = 2048)
    private String actionDetail;
    
    private Boolean success;
    
    @Column(length = 1024)
    private String errorMessage;
    
    private LocalDateTime actionTime;
    
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        actionTime = LocalDateTime.now();
    }
}
