package com.example.config.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "client_push_status", indexes = {
        @Index(name = "idx_release_instance", columnList = "releaseId, instanceId", unique = true),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_instance_id", columnList = "instanceId"),
        @Index(name = "idx_updated_at", columnList = "updatedAt")
})
public class ClientPushStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String releaseId;

    @Column(nullable = false, length = 128)
    private String instanceId;

    @Column(nullable = false, length = 256)
    private String configKey;

    @Column(nullable = false)
    private Long targetVersion;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private PushStatus status;

    @Column
    private Integer retryCount;

    @Column(columnDefinition = "TEXT")
    private String lastError;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    private LocalDateTime succeededAt;

    private LocalDateTime nextRetryAt;

    public enum PushStatus {
        PENDING, SENDING, SUCCESS, FAILED, TIMEOUT, SKIPPED
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (status == null) status = PushStatus.PENDING;
        if (retryCount == null) retryCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
