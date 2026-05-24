package com.hospital.oxygen.dto;

import java.time.LocalDateTime;

public class BorrowRequest {
    private String equipmentCode;
    private String patientId;
    private String borrower;
    private String borrowWard;
    private LocalDateTime expectedReturnTime;
    private String remarks;
    private String operator;

    public String getEquipmentCode() { return equipmentCode; }
    public void setEquipmentCode(String equipmentCode) { this.equipmentCode = equipmentCode; }
    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }
    public String getBorrower() { return borrower; }
    public void setBorrower(String borrower) { this.borrower = borrower; }
    public String getBorrowWard() { return borrowWard; }
    public void setBorrowWard(String borrowWard) { this.borrowWard = borrowWard; }
    public LocalDateTime getExpectedReturnTime() { return expectedReturnTime; }
    public void setExpectedReturnTime(LocalDateTime expectedReturnTime) { this.expectedReturnTime = expectedReturnTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
