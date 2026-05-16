package com.connector.ratelimit.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sleep_strategy")
public class SleepStrategy {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String strategyCode;

    @Column(nullable = false)
    private String strategyName;

    @Column(nullable = false)
    private Integer sleepLevel;

    @Column(nullable = false)
    private Long sleepDurationSeconds;

    private String backoffType = "FIXED";

    private Double backoffMultiplier;

    private Integer maxRetryCount;

    private Boolean enabled = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
