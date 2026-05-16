package com.connector.ratelimit.model.entity;

import com.connector.ratelimit.model.enums.SleepStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "recovery_event")
public class RecoveryEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String connectorCode;

    @Column(nullable = false, unique = true)
    private String eventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SleepStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SleepStatus toStatus;

    private String triggerSource;

    private String reason;

    private String operator;

    private Boolean isIdempotent = false;

    private String idempotentKey;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
