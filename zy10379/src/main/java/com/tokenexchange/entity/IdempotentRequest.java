package com.tokenexchange.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "idempotent_request")
public class IdempotentRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 128)
    private String requestId;

    @Column(nullable = false, length = 128)
    private String operationType;

    @Column(length = 2048)
    private String requestHash;

    @Column(length = 4096)
    private String responseData;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
