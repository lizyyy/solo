package com.livestock.transfer.dto;

import java.time.LocalDate;
import java.util.List;

public class TransferCreateRequest {
    private String sourceFarmCode;
    private String targetFarmCode;
    private String certificateNo;
    private String vehiclePlateNo;
    private Integer plannedQuantity;
    private LocalDate transferDate;
    private List<String> earTags;
    private String remark;
    private String operator;

    public String getSourceFarmCode() { return sourceFarmCode; }
    public void setSourceFarmCode(String sourceFarmCode) { this.sourceFarmCode = sourceFarmCode; }
    public String getTargetFarmCode() { return targetFarmCode; }
    public void setTargetFarmCode(String targetFarmCode) { this.targetFarmCode = targetFarmCode; }
    public String getCertificateNo() { return certificateNo; }
    public void setCertificateNo(String certificateNo) { this.certificateNo = certificateNo; }
    public String getVehiclePlateNo() { return vehiclePlateNo; }
    public void setVehiclePlateNo(String vehiclePlateNo) { this.vehiclePlateNo = vehiclePlateNo; }
    public Integer getPlannedQuantity() { return plannedQuantity; }
    public void setPlannedQuantity(Integer plannedQuantity) { this.plannedQuantity = plannedQuantity; }
    public LocalDate getTransferDate() { return transferDate; }
    public void setTransferDate(LocalDate transferDate) { this.transferDate = transferDate; }
    public List<String> getEarTags() { return earTags; }
    public void setEarTags(List<String> earTags) { this.earTags = earTags; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
