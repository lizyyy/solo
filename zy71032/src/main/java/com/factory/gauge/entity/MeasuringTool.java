package com.factory.gauge.entity;

import com.factory.gauge.entity.enums.GaugeStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "measuring_tool", indexes = {
    @Index(name = "idx_tool_no", columnList = "toolNo", unique = true),
    @Index(name = "idx_status", columnList = "status")
})
public class MeasuringTool {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String toolNo;

    @Column(nullable = false, length = 100)
    private String toolName;

    @Column(length = 200)
    private String specification;

    @Column(nullable = false, length = 50)
    private String calibrationCertificateNo;

    @Column(nullable = false)
    private Integer certificateVersion = 1;

    @Column(nullable = false)
    private LocalDate calibrationDate;

    @Column(nullable = false)
    private LocalDate validUntilDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GaugeStatus status = GaugeStatus.NORMAL;

    @Column(length = 500)
    private String remarks;

    @Column(length = 100)
    private String createdBy;

    @Column(length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;

    public boolean isExpired() {
        return LocalDate.now().isAfter(validUntilDate);
    }

    public boolean isUsable() {
        return status == GaugeStatus.NORMAL && !isExpired();
    }
}
