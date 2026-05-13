package com.infrastructure.drain.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "persistent_connections")
public class PersistentConnection {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 128)
    private String connectionId;
    
    @Column(nullable = false, length = 128)
    private String instanceId;
    
    @Column(length = 64)
    private String clientIp;
    
    private Integer clientPort;
    
    @Column(length = 128)
    private String protocol;
    
    private LocalDateTime connectedAt;
    
    private LocalDateTime lastActiveAt;
    
    private Long durationSeconds;
    
    @Column(length = 32)
    private String status;
    
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
