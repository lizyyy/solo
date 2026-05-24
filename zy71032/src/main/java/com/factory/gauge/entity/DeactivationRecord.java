package com.factory.gauge.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "deactivation_record", indexes = {
    @Index(name = "idx_deact_tool_id", columnList = "toolId"),
    @Index(name = "idx_deact_is_active", columnList = "isActive")
})
public class DeactivationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Column(nullable = false, length = 200)
    private String reason;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, length = 100)
    private String operator;

    private LocalDateTime deactivatedAt;

    private LocalDateTime reactivatedAt;

    @Column(length = 100)
    private String reactivatedBy;

    @Column(length = 500)
    private String reactivationRemark;

    @Column(nullable = false)
    private Boolean isActive = true;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getToolId() { return toolId; }
    public void setToolId(Long toolId) { this.toolId = toolId; }
    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public LocalDateTime getDeactivatedAt() { return deactivatedAt; }
    public void setDeactivatedAt(LocalDateTime deactivatedAt) { this.deactivatedAt = deactivatedAt; }
    public LocalDateTime getReactivatedAt() { return reactivatedAt; }
    public void setReactivatedAt(LocalDateTime reactivatedAt) { this.reactivatedAt = reactivatedAt; }
    public String getReactivatedBy() { return reactivatedBy; }
    public void setReactivatedBy(String reactivatedBy) { this.reactivatedBy = reactivatedBy; }
    public String getReactivationRemark() { return reactivationRemark; }
    public void setReactivationRemark(String reactivationRemark) { this.reactivationRemark = reactivationRemark; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
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
