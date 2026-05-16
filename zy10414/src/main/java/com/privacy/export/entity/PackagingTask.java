package com.privacy.export.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "packaging_task")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackagingTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_request_id", nullable = false, unique = true)
    private ExportRequest exportRequest;

    @Column(nullable = false, unique = true)
    private String taskId;

    @Column(nullable = false)
    private Integer attemptCount;

    @Column(nullable = false)
    private Boolean isCompleted;

    private Boolean isSuccess;

    private String packageFormat;

    private Long packageSize;

    private String packageChecksum;

    private String storagePath;

    private String downloadUrl;

    private Integer fileCount;

    @Column(length = 5000)
    private String includedFields;

    @Column(length = 5000)
    private String excludedFields;

    @Column(length = 5000)
    private String packagingLog;

    @Column(length = 5000)
    private String errorDetails;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String executedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (attemptCount == null) {
            attemptCount = 0;
        }
        if (isCompleted == null) {
            isCompleted = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
