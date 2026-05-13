package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import com.object.lifecycle.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "archive_task")
@Getter
@Setter
public class ArchiveTask extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String taskId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id", nullable = false)
    private LifecycleRule rule;

    @Column(nullable = false)
    private String objectKey;

    @Column(nullable = false)
    private String bucketName;

    private Long objectSize;

    private String sourceStorageClass;

    private String targetStorageClass;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.PENDING;

    private LocalDateTime scheduledTime;

    private LocalDateTime startTime;

    private LocalDateTime completedTime;

    private String errorMessage;

    private Integer retryCount = 0;

    @Version
    private Long version;
}
