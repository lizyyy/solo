package com.batchqueue.model.entity;

import com.batchqueue.model.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "schedule_logs")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(length = 128)
    private String taskName;

    @Enumerated(EnumType.STRING)
    private TaskStatus previousStatus;

    @Enumerated(EnumType.STRING)
    private TaskStatus newStatus;

    @Column(length = 1024)
    private String message;

    @Column(length = 128)
    private String operator;

    @Column
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
