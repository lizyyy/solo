package com.example.lock.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "idempotent_request", indexes = {
    @Index(name = "idx_request_id", columnList = "requestId", unique = true)
})
public class IdempotentRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true)
    private String requestId;

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(name = "operation_type", nullable = false)
    private String operationType;

    @Column(name = "response_data", length = 4000)
    private String responseData;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
