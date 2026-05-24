package com.warehouse.charging.model;

import com.warehouse.charging.enums.ReservationStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "schedule_logs")
public class ScheduleLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String requestId;

    private Long reservationId;

    private String robotCode;

    private String stationCode;

    private String operationType;

    @Enumerated(EnumType.STRING)
    private ReservationStatus fromStatus;

    @Enumerated(EnumType.STRING)
    private ReservationStatus toStatus;

    @Column(length = 2000)
    private String evidence;

    @Column(length = 1000)
    private String ruleApplied;

    @Column(length = 1000)
    private String decisionReason;

    private String operator;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public String getRobotCode() { return robotCode; }
    public void setRobotCode(String robotCode) { this.robotCode = robotCode; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getOperationType() { return operationType; }
    public void setOperationType(String operationType) { this.operationType = operationType; }
    public ReservationStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(ReservationStatus fromStatus) { this.fromStatus = fromStatus; }
    public ReservationStatus getToStatus() { return toStatus; }
    public void setToStatus(ReservationStatus toStatus) { this.toStatus = toStatus; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public String getRuleApplied() { return ruleApplied; }
    public void setRuleApplied(String ruleApplied) { this.ruleApplied = ruleApplied; }
    public String getDecisionReason() { return decisionReason; }
    public void setDecisionReason(String decisionReason) { this.decisionReason = decisionReason; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
