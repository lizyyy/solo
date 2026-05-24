package com.pottery.kilnqueue.entity;

import com.pottery.kilnqueue.enums.DecisionType;
import com.pottery.kilnqueue.enums.QueueStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "processing_logs")
public class ProcessingLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "queue_record_id", nullable = false)
    private QueueRecord queueRecord;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DecisionType decisionType;

    @Enumerated(EnumType.STRING)
    private QueueStatus previousStatus;

    @Enumerated(EnumType.STRING)
    private QueueStatus newStatus;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String evidence;

    private String operator;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public QueueRecord getQueueRecord() { return queueRecord; }
    public void setQueueRecord(QueueRecord queueRecord) { this.queueRecord = queueRecord; }
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
