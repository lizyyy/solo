package com.tokenexchange.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exchange_scenario")
public class ExchangeScenario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 64)
    private String scenarioCode;

    @Column(nullable = false, length = 128)
    private String scenarioName;

    @Column(length = 512)
    private String description;

    @Column(nullable = false, length = 64)
    private String sourceServiceId;

    @Column(nullable = false, length = 64)
    private String targetServiceId;

    @Column(length = 1024)
    private String allowedScopes;

    @Column(nullable = false)
    private Integer defaultExpireMinutes = 15;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(nullable = false)
    private LocalDateTime createdAt;

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
