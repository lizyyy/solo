package com.port.reefer.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String operation;

    private String entityType;

    private Long entityId;

    private Long inspectorId;

    @Column(length = 2000)
    private String beforeState;

    @Column(length = 2000)
    private String afterState;

    private String remark;

    private Boolean isDuplicate;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isDuplicate == null) {
            isDuplicate = false;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOperation() { return operation; }
    public void setOperation(String operation) { this.operation = operation; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public Long getInspectorId() { return inspectorId; }
    public void setInspectorId(Long inspectorId) { this.inspectorId = inspectorId; }
    public String getBeforeState() { return beforeState; }
    public void setBeforeState(String beforeState) { this.beforeState = beforeState; }
    public String getAfterState() { return afterState; }
    public void setAfterState(String afterState) { this.afterState = afterState; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public Boolean getIsDuplicate() { return isDuplicate; }
    public void setIsDuplicate(Boolean isDuplicate) { this.isDuplicate = isDuplicate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
