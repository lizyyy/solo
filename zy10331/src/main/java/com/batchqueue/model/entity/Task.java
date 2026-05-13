package com.batchqueue.model.entity;

import com.batchqueue.model.enums.TaskPriority;
import com.batchqueue.model.enums.TaskStatus;
import com.batchqueue.model.enums.TaskType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tasks")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 64)
    private String taskId;

    @Column(nullable = false, length = 128)
    private String taskName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskType taskType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    @Column(length = 1024)
    private String payload;

    @Column(length = 2048)
    private String result;

    @Column(length = 128)
    private String handler;

    private Integer executionSlot;

    private LocalDateTime createdAt;

    private LocalDateTime queuedAt;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private Long waitDurationSeconds;

    private Long executionDurationSeconds;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = TaskStatus.PENDING;
        }
    }
}
