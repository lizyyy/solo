package com.factory.gauge.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getToolId() { return toolId; }
    public void setToolId(Long toolId) { this.toolId = toolId; }
    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getCertificateNo() { return certificateNo; }
    public void setCertificateNo(String certificateNo) { this.certificateNo = certificateNo; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public LocalDate getCalibrationDate() { return calibrationDate; }
    public void setCalibrationDate(LocalDate calibrationDate) { this.calibrationDate = calibrationDate; }
    public LocalDate getValidUntilDate() { return validUntilDate; }
    public void setValidUntilDate(LocalDate validUntilDate) { this.validUntilDate = validUntilDate; }
    public String getCalibrationAgency() { return calibrationAgency; }
    public void setCalibrationAgency(String calibrationAgency) { this.calibrationAgency = calibrationAgency; }
    public String getCalibrator() { return calibrator; }
    public void setCalibrator(String calibrator) { this.calibrator = calibrator; }
    public String getCalibrationItems() { return calibrationItems; }
    public void setCalibrationItems(String calibrationItems) { this.calibrationItems = calibrationItems; }
    public String getCalibrationResult() { return calibrationResult; }
    public void setCalibrationResult(String calibrationResult) { this.calibrationResult = calibrationResult; }
    public Boolean getIsPassed() { return isPassed; }
    public void setIsPassed(Boolean isPassed) { this.isPassed = isPassed; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Integer getVersionLock() { return versionLock; }
    public void setVersionLock(Integer versionLock) { this.versionLock = versionLock; }
}
