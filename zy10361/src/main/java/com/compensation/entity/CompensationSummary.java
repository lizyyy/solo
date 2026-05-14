package com.compensation.entity;

import com.compensation.enums.ProcessStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compensation_summary")
public class CompensationSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", unique = true, nullable = false, length = 64)
    private String processId;

    @Column(name = "total_instructions")
    private Integer totalInstructions = 0;

    @Column(name = "success_count")
    private Integer successCount = 0;

    @Column(name = "failed_count")
    private Integer failedCount = 0;

    @Column(name = "pending_count")
    private Integer pendingCount = 0;

    @Column(name = "manual_confirmed_count")
    private Integer manualConfirmedCount = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_status", nullable = false, length = 32)
    private ProcessStatus overallStatus;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
