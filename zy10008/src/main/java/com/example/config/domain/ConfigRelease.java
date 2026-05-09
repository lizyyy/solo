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
@Table(name = "config_release", indexes = {
        @Index(name = "idx_release_id", columnList = "releaseId", unique = true),
        @Index(name = "idx_namespace", columnList = "namespace"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_created_at", columnList = "createdAt")
})
public class ConfigRelease {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String releaseId;

    @Column(nullable = false, length = 128)
    private String namespace;

    @Column(nullable = false, length = 256)
    private String configKey;

    @Column(nullable = false)
    private Long fromVersion;

    @Column(nullable = false)
    private Long toVersion;

    @Column(columnDefinition = "TEXT")
    private String changeSummary;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private ReleaseStatus status;

    @Column(length = 64)
    private String releasedBy;

    @Column(columnDefinition = "TEXT")
    private String failureReason;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    public enum ReleaseStatus {
        PENDING, PUBLISHING, PARTIAL_SUCCESS, SUCCESS, FAILED, ROLLED_BACK
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = ReleaseStatus.PENDING;
    }
}
