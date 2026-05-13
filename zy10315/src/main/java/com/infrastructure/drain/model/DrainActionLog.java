package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "drain_action_logs")
public class DrainActionLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 64)
    private String batchId;
    
    @Column(length = 128)
    private String instanceId;
    
    @Column(nullable = false, length = 128)
    private String operator;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DrainStatus fromStatus;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DrainStatus toStatus;
    
    @Column(length = 1024)
    private String remark;
    
    private LocalDateTime actionTime;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private DrainBatch batch;
    
    @PrePersist
    protected void onCreate() {
        actionTime = LocalDateTime.now();
    }
}
