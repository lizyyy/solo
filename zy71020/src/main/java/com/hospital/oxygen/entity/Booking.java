package com.hospital.oxygen.entity;

import com.hospital.oxygen.enums.BookingStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String bookingNumber;

    @Column(nullable = false)
    private String patientId;

    @Column(nullable = false)
    private String ward;

    private String bedNumber;

    @Column(nullable = false)
    private String oxygenPortCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status = BookingStatus.PENDING;

    private LocalDateTime startTime;
    private LocalDateTime expectedEndTime;
    private LocalDateTime actualEndTime;

    private String remarks;
    private String operator;

    private Boolean isOverridden = false;
    private String overrideReason;
    private String overrideOperator;

    private String ruleViolations;
    private String ruleResults;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (startTime == null) {
            startTime = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBookingNumber() { return bookingNumber; }
    public void setBookingNumber(String bookingNumber) { this.bookingNumber = bookingNumber; }
    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }
    public String getWard() { return ward; }
    public void setWard(String ward) { this.ward = ward; }
    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }
    public String getOxygenPortCode() { return oxygenPortCode; }
    public void setOxygenPortCode(String oxygenPortCode) { this.oxygenPortCode = oxygenPortCode; }
    public BookingStatus getStatus() { return status; }
    public void setStatus(BookingStatus status) { this.status = status; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getExpectedEndTime() { return expectedEndTime; }
    public void setExpectedEndTime(LocalDateTime expectedEndTime) { this.expectedEndTime = expectedEndTime; }
    public LocalDateTime getActualEndTime() { return actualEndTime; }
    public void setActualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public Boolean getIsOverridden() { return isOverridden; }
    public void setIsOverridden(Boolean isOverridden) { this.isOverridden = isOverridden; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
    public String getOverrideOperator() { return overrideOperator; }
    public void setOverrideOperator(String overrideOperator) { this.overrideOperator = overrideOperator; }
    public String getRuleViolations() { return ruleViolations; }
    public void setRuleViolations(String ruleViolations) { this.ruleViolations = ruleViolations; }
    public String getRuleResults() { return ruleResults; }
    public void setRuleResults(String ruleResults) { this.ruleResults = ruleResults; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
