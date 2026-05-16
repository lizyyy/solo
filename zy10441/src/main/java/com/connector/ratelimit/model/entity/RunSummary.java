package com.connector.ratelimit.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "run_summary")
public class RunSummary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String connectorCode;

    @Column(nullable = false)
    private String summaryDate;

    private Integer totalRequests;

    private Integer successCount;

    private Integer failureCount;

    private Integer rateLimitCount;

    private Integer sleepCount;

    private Integer recoveryCount;

    private Long totalSleepSeconds;

    private String failureReasons;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
