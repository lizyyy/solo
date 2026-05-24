package com.pottery.kilnqueue.dto;

import com.pottery.kilnqueue.enums.DecisionType;
import com.pottery.kilnqueue.enums.QueueStatus;

import java.time.LocalDateTime;

public class ProcessingLogDTO {
    private DecisionType decisionType;
    private QueueStatus previousStatus;
    private QueueStatus newStatus;
    private String reason;
    private String evidence;
    private String operator;
    private LocalDateTime createdAt;

    public ProcessingLogDTO() {}

    private ProcessingLogDTO(Builder builder) {
        this.decisionType = builder.decisionType;
        this.previousStatus = builder.previousStatus;
        this.newStatus = builder.newStatus;
        this.reason = builder.reason;
        this.evidence = builder.evidence;
        this.operator = builder.operator;
        this.createdAt = builder.createdAt;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private DecisionType decisionType;
        private QueueStatus previousStatus;
        private QueueStatus newStatus;
        private String reason;
        private String evidence;
        private String operator;
        private LocalDateTime createdAt;

        public Builder decisionType(DecisionType decisionType) { this.decisionType = decisionType; return this; }
        public Builder previousStatus(QueueStatus previousStatus) { this.previousStatus = previousStatus; return this; }
        public Builder newStatus(QueueStatus newStatus) { this.newStatus = newStatus; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder evidence(String evidence) { this.evidence = evidence; return this; }
        public Builder operator(String operator) { this.operator = operator; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public ProcessingLogDTO build() { return new ProcessingLogDTO(this); }
    }

    public DecisionType getDecisionType() { return decisionType; }
    public void setDecisionType(DecisionType decisionType) { this.decisionType = decisionType; }
    public QueueStatus getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(QueueStatus previousStatus) { this.previousStatus = previousStatus; }
    public QueueStatus getNewStatus() { return newStatus; }
    public void setNewStatus(QueueStatus newStatus) { this.newStatus = newStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
