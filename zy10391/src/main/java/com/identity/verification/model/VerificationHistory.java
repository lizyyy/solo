package com.identity.verification.model;

import com.identity.verification.model.enums.VerificationStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "verification_history")
public class VerificationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 30)
    private VerificationStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 30)
    private VerificationStatus newStatus;

    @Column(name = "action_type", nullable = false, length = 50)
    private String actionType;

    @Column(name = "operator_id", length = 50)
    private String operatorId;

    @Column(name = "operator_name", length = 100)
    private String operatorName;

    @Column(length = 2000)
    private String description;

    @Column(name = "field_name", length = 100)
    private String fieldName;

    @Column(name = "final_value", length = 500)
    private String finalValue;

    @Column(name = "conflict_count")
    private Integer conflictCount;

    @Column(name = "trust_score")
    private Integer trustScore;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public VerificationStatus getPreviousStatus() {
        return previousStatus;
    }

    public void setPreviousStatus(VerificationStatus previousStatus) {
        this.previousStatus = previousStatus;
    }

    public VerificationStatus getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(VerificationStatus newStatus) {
        this.newStatus = newStatus;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public String getOperatorName() {
        return operatorName;
    }

    public void setOperatorName(String operatorName) {
        this.operatorName = operatorName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getFinalValue() {
        return finalValue;
    }

    public void setFinalValue(String finalValue) {
        this.finalValue = finalValue;
    }

    public Integer getConflictCount() {
        return conflictCount;
    }

    public void setConflictCount(Integer conflictCount) {
        this.conflictCount = conflictCount;
    }

    public Integer getTrustScore() {
        return trustScore;
    }

    public void setTrustScore(Integer trustScore) {
        this.trustScore = trustScore;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
