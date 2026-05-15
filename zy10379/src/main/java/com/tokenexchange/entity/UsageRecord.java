package com.tokenexchange.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "usage_record")
public class UsageRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 512)
    private String tokenValue;

    @Column(length = 64)
    private String tokenType;

    @Column(nullable = false, length = 128)
    private String userId;

    @Column(length = 64)
    private String serviceId;

    @Column(length = 128)
    private String operation;

    @Column(length = 1024)
    private String requestId;

    @Column(length = 2048)
    private String requestDetails;

    @Column(length = 64)
    private String clientIp;

    @Column(length = 256)
    private String userAgent;

    private Boolean success = true;

    @Column(length = 1024)
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
        createdAt = LocalDateTime.now();
    }
}
