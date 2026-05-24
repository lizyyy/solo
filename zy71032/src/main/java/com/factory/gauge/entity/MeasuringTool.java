package com.factory.gauge.entity;

import com.factory.gauge.entity.enums.GaugeStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }
    public String getSpecification() { return specification; }
    public void setSpecification(String specification) { this.specification = specification; }
    public String getCalibrationCertificateNo() { return calibrationCertificateNo; }
    public void setCalibrationCertificateNo(String calibrationCertificateNo) { this.calibrationCertificateNo = calibrationCertificateNo; }
    public Integer getCertificateVersion() { return certificateVersion; }
    public void setCertificateVersion(Integer certificateVersion) { this.certificateVersion = certificateVersion; }
    public LocalDate getCalibrationDate() { return calibrationDate; }
    public void setCalibrationDate(LocalDate calibrationDate) { this.calibrationDate = calibrationDate; }
    public LocalDate getValidUntilDate() { return validUntilDate; }
    public void setValidUntilDate(LocalDate validUntilDate) { this.validUntilDate = validUntilDate; }
    public GaugeStatus getStatus() { return status; }
    public void setStatus(GaugeStatus status) { this.status = status; }
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
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
