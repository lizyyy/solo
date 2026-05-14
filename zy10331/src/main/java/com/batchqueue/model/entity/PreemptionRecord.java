package com.batchqueue.model.entity;

import com.batchqueue.model.enums.TaskPriority;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "preemption_records")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PreemptionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long preemptedTaskId;

    @Column(length = 128)
    private String preemptedTaskName;

    @Enumerated(EnumType.STRING)
    private TaskPriority preemptedPriority;

    @Column(nullable = false)
    private Long preemptingTaskId;

    @Column(length = 128)
    private String preemptingTaskName;

    @Enumerated(EnumType.STRING)
    private TaskPriority preemptingPriority;

    @Column
    private Integer executionSlot;

    @Column(length = 128)
    private String reason;

    @Column
    private LocalDateTime preemptedAt;

    @PrePersist
    protected void onCreate() {
        preemptedAt = LocalDateTime.now();
    }
}
