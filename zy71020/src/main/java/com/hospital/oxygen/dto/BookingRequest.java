package com.hospital.oxygen.dto;

import java.time.LocalDateTime;

public class BookingRequest {
    private String patientId;
    private String ward;
    private String bedNumber;
    private String oxygenPortCode;
    private LocalDateTime startTime;
    private LocalDateTime expectedEndTime;
    private String remarks;
    private String operator;

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }
    public String getWard() { return ward; }
    public void setWard(String ward) { this.ward = ward; }
    public String getBedNumber() { return bedNumber; }
    public void setBedNumber(String bedNumber) { this.bedNumber = bedNumber; }
    public String getOxygenPortCode() { return oxygenPortCode; }
    public void setOxygenPortCode(String oxygenPortCode) { this.oxygenPortCode = oxygenPortCode; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getExpectedEndTime() { return expectedEndTime; }
    public void setExpectedEndTime(LocalDateTime expectedEndTime) { this.expectedEndTime = expectedEndTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
