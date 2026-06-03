package com.aerialsurvey.entity;

import com.aerialsurvey.enums.ProcessStep;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "process_trace")
public class ProcessTrace {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProcessStep processStep;

    private Long relatedRecordId;

    @Column(nullable = false)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime operatedAt;

    private String remark;

    @PrePersist
    protected void onCreate() {
        operatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getParkingLotCode() {
        return parkingLotCode;
    }

    public void setParkingLotCode(String parkingLotCode) {
        this.parkingLotCode = parkingLotCode;
    }

    public ProcessStep getProcessStep() {
        return processStep;
    }

    public void setProcessStep(ProcessStep processStep) {
        this.processStep = processStep;
    }

    public Long getRelatedRecordId() {
        return relatedRecordId;
    }

    public void setRelatedRecordId(Long relatedRecordId) {
        this.relatedRecordId = relatedRecordId;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public LocalDateTime getOperatedAt() {
        return operatedAt;
    }

    public void setOperatedAt(LocalDateTime operatedAt) {
        this.operatedAt = operatedAt;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    @Override
    public String toString() {
        return "ProcessTrace{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", processStep=" + processStep +
                ", relatedRecordId=" + relatedRecordId +
                ", operator='" + operator + '\'' +
                ", operatedAt=" + operatedAt +
                ", remark='" + remark + '\'' +
                '}';
    }
}
