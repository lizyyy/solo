package com.factory.gauge.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "calibration_report", indexes = {
    @Index(name = "idx_calib_tool_id", columnList = "toolId"),
    @Index(name = "idx_calib_cert_no", columnList = "certificateNo")
})
public class CalibrationReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Column(nullable = false, length = 50)
    private String certificateNo;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(nullable = false)
    private LocalDate calibrationDate;

    @Column(nullable = false)
    private LocalDate validUntilDate;

    @Column(length = 100)
    private String calibrationAgency;

    @Column(length = 100)
    private String calibrator;

    @Column(length = 2000)
    private String calibrationItems;

    @Column(length = 2000)
    private String calibrationResult;

    @Column(nullable = false)
    private Boolean isPassed = true;

    @Column(length = 500)
    private String fileUrl;

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
    private Integer versionLock;
}
