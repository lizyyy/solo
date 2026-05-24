package com.livestock.transfer.dto;

import com.livestock.transfer.entity.*;
import com.livestock.transfer.enums.TransferStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class TransferDetailVO {
    private Long id;
    private String transferNo;
    private Farm sourceFarm;
    private Farm targetFarm;
    private QuarantineCertificate certificate;
    private TransportVehicle vehicle;
    private Integer plannedQuantity;
    private Integer actualQuantity;
    private LocalDate transferDate;
    private TransferStatus status;
    private String statusDescription;
    private String remark;
    private LocalDateTime createdAt;
    private String createdBy;
    
    private List<TransferEarTag> earTags;
    private List<TransferValidation> validations;
    private List<AcceptanceRecord> acceptanceRecords;
    private List<OperationLog> operationLogs;
    private List<TransferReport> reports;
    
    public String getStatusDescription() {
        return status != null ? status.getDescription() : null;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTransferNo() { return transferNo; }
    public void setTransferNo(String transferNo) { this.transferNo = transferNo; }
    public Farm getSourceFarm() { return sourceFarm; }
    public void setSourceFarm(Farm sourceFarm) { this.sourceFarm = sourceFarm; }
    public Farm getTargetFarm() { return targetFarm; }
    public void setTargetFarm(Farm targetFarm) { this.targetFarm = targetFarm; }
    public QuarantineCertificate getCertificate() { return certificate; }
    public void setCertificate(QuarantineCertificate certificate) { this.certificate = certificate; }
    public TransportVehicle getVehicle() { return vehicle; }
    public void setVehicle(TransportVehicle vehicle) { this.vehicle = vehicle; }
    public Integer getPlannedQuantity() { return plannedQuantity; }
    public void setPlannedQuantity(Integer plannedQuantity) { this.plannedQuantity = plannedQuantity; }
    public Integer getActualQuantity() { return actualQuantity; }
    public void setActualQuantity(Integer actualQuantity) { this.actualQuantity = actualQuantity; }
    public LocalDate getTransferDate() { return transferDate; }
    public void setTransferDate(LocalDate transferDate) { this.transferDate = transferDate; }
    public TransferStatus getStatus() { return status; }
    public void setStatus(TransferStatus status) { this.status = status; }
    public void setStatusDescription(String statusDescription) { this.statusDescription = statusDescription; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public List<TransferEarTag> getEarTags() { return earTags; }
    public void setEarTags(List<TransferEarTag> earTags) { this.earTags = earTags; }
    public List<TransferValidation> getValidations() { return validations; }
    public void setValidations(List<TransferValidation> validations) { this.validations = validations; }
    public List<AcceptanceRecord> getAcceptanceRecords() { return acceptanceRecords; }
    public void setAcceptanceRecords(List<AcceptanceRecord> acceptanceRecords) { this.acceptanceRecords = acceptanceRecords; }
    public List<OperationLog> getOperationLogs() { return operationLogs; }
    public void setOperationLogs(List<OperationLog> operationLogs) { this.operationLogs = operationLogs; }
    public List<TransferReport> getReports() { return reports; }
    public void setReports(List<TransferReport> reports) { this.reports = reports; }
}
