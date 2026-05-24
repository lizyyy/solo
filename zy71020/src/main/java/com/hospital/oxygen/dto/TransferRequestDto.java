package com.hospital.oxygen.dto;

public class TransferRequestDto {
    private String patientId;
    private String fromWard;
    private String toWard;
    private String fromBed;
    private String toBed;
    private String oxygenPortCode;
    private String remarks;
    private String operator;

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }
    public String getFromWard() { return fromWard; }
    public void setFromWard(String fromWard) { this.fromWard = fromWard; }
    public String getToWard() { return toWard; }
    public void setToWard(String toWard) { this.toWard = toWard; }
    public String getFromBed() { return fromBed; }
    public void setFromBed(String fromBed) { this.fromBed = fromBed; }
    public String getToBed() { return toBed; }
    public void setToBed(String toBed) { this.toBed = toBed; }
    public String getOxygenPortCode() { return oxygenPortCode; }
    public void setOxygenPortCode(String oxygenPortCode) { this.oxygenPortCode = oxygenPortCode; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
