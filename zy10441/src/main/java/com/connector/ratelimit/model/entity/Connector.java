package com.connector.ratelimit.model.entity;

import com.connector.ratelimit.model.enums.SleepStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "connector")
public class Connector {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String connectorCode;

    @Column(nullable = false)
    private String connectorName;

    private String description;

    @Column(nullable = false)
    private String supplierCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SleepStatus status = SleepStatus.ACTIVE;

    private Integer currentSleepLevel = 0;

    private LocalDateTime sleepStartTime;

    private LocalDateTime expectedWakeTime;

    private String lastError;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
