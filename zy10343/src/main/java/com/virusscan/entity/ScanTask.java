package com.virusscan.entity;

import com.virusscan.enums.ScanEngine;
import com.virusscan.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "scan_tasks", indexes = {
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_file_id", columnList = "fileId"),
    @Index(name = "idx_create_time", columnList = "createTime")
})
public class ScanTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String taskId;

    @Column(nullable = false, length = 64)
    private String fileId;

    @Column(length = 64)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TaskStatus status;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ScanEngine scanEngine;

    @Column(length = 500)
    private String scanResult;

    @Column(length = 1000)
    private String virusDetails;

    private Integer retryCount = 0;

    private Integer maxRetry = 3;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    @Column(length = 100)
    private String requestedBy;

    @Column(length = 50)
    private String callbackUrl;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;

    @Version
    private Long version;
}