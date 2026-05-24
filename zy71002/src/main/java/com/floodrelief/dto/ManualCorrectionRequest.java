package com.floodrelief.dto;

public class ManualCorrectionRequest {
    private String correctedBy;
    private String reason;
    private Integer newQuantity;

    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Integer getNewQuantity() { return newQuantity; }
    public void setNewQuantity(Integer newQuantity) { this.newQuantity = newQuantity; }
}
