package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "traffic_offload_results")
public class TrafficOffloadResult {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 128)
    private String instanceId;
    
    @Column(nullable = false, length = 64)
    private String batchId;
    
    private Boolean success;
    
    @Column(length = 1024)
    private String message;
    
    private Integer initialConnections;
    
    private Integer finalConnections;
    
    private Integer initialTasks;
    
    private Integer finalTasks;
    
    private LocalDateTime offloadStartTime;
    
    private LocalDateTime offloadEndTime;
    
    private Long durationSeconds;
    
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
