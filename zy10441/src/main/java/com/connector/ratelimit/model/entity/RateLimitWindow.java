package com.connector.ratelimit.model.entity;

import com.connector.ratelimit.model.enums.RateLimitType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rate_limit_window")
public class RateLimitWindow {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String connectorCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RateLimitType limitType;

    @Column(nullable = false)
    private Integer limitValue;

    @Column(nullable = false)
    private Integer currentValue;

    @Column(nullable = false)
    private LocalDateTime windowStart;

    @Column(nullable = false)
    private LocalDateTime windowEnd;

    private Boolean isBreached = false;

    private LocalDateTime breachedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
