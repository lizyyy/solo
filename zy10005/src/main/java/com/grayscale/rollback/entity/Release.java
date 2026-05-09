package com.grayscale.rollback.entity;

import com.grayscale.rollback.enums.ReleaseStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "releases", indexes = {
    @Index(name = "idx_release_status", columnList = "status"),
    @Index(name = "idx_service_name", columnList = "serviceName"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Release {
    
    @Id
    @Column(updatable = false, nullable = false)
    private String id;
    
    @Column(nullable = false)
    private String serviceName;
    
    @Column(nullable = false)
    private String currentVersion;
    
    @Column(nullable = false)
    private String targetVersion;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ReleaseStatus status;
    
    @Column(nullable = false)
    private Integer totalInstances;
    
    @Column(nullable = false)
    private Integer updatedInstances;
    
    @Column(columnDefinition = "TEXT")
    private String rollbackCheckpoint;
    
    @Column(columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(columnDefinition = "TEXT")
    private String metadata;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime startedAt;
    
    private LocalDateTime completedAt;
    
    private LocalDateTime failedAt;
    
    @Version
    private Long version;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (updatedInstances == null) {
            updatedInstances = 0;
        }
    }
}
