package com.aerialsurvey.entity;

import com.aerialsurvey.enums.SelfCheckType;
import com.aerialsurvey.enums.SelfCheckResult;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "self_check_record")
public class SelfCheckRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SelfCheckType checkType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SelfCheckResult checkResult;

    @Column(columnDefinition = "TEXT")
    private String checkDetail;

    private String relatedRecordId;

    @Column(nullable = false)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime operatedAt;

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

    public SelfCheckType getCheckType() {
        return checkType;
    }

    public void setCheckType(SelfCheckType checkType) {
        this.checkType = checkType;
    }

    public SelfCheckResult getCheckResult() {
        return checkResult;
    }

    public void setCheckResult(SelfCheckResult checkResult) {
        this.checkResult = checkResult;
    }

    public String getCheckDetail() {
        return checkDetail;
    }

    public void setCheckDetail(String checkDetail) {
        this.checkDetail = checkDetail;
    }

    public String getRelatedRecordId() {
        return relatedRecordId;
    }

    public void setRelatedRecordId(String relatedRecordId) {
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

    @Override
    public String toString() {
        return "SelfCheckRecord{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", checkType=" + checkType +
                ", checkResult=" + checkResult +
                ", checkDetail='" + checkDetail + '\'' +
                ", relatedRecordId='" + relatedRecordId + '\'' +
                ", operator='" + operator + '\'' +
                ", operatedAt=" + operatedAt +
                '}';
    }
}
