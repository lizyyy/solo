package com.grayscale.rollback.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "idempotent_records", indexes = {
    @Index(name = "idx_idempotent_key", columnList = "idempotentKey", unique = true),
    @Index(name = "idx_idempotent_created_at", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdempotentRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String idempotentKey;
    
    @Column(nullable = false)
    private String releaseId;
    
    @Column(nullable = false)
    private String operationType;
    
    @Column(columnDefinition = "TEXT")
    private String requestHash;
    
    @Column(columnDefinition = "TEXT")
    private String responseData;
    
    @Column(nullable = false)
    private Boolean processed;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime expiresAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (processed == null) {
            processed = false;
        }
    }
}
