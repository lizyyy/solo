package com.certificate.health.model;

import com.certificate.health.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "expiry_window")
public class ExpiryWindow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "not_before")
    private LocalDateTime notBefore;

    @Column(name = "not_after")
    private LocalDateTime notAfter;

    @Column(name = "days_until_expiry")
    private Long daysUntilExpiry;

    @Column(name = "is_expired")
    private Boolean isExpired;

    @Column(name = "is_near_expiry")
    private Boolean isNearExpiry;

    @Column(name = "near_expiry_threshold_days")
    private Integer nearExpiryThresholdDays;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level")
    private RiskLevel riskLevel;

    @Column(name = "warning_description", length = 500)
    private String warningDescription;
}
