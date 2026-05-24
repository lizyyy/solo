package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;

public class AllocationRequest {
    @NotNull(message = "安置点ID不能为空")
    private Long shelterId;

    @NotNull(message = "物资批次ID不能为空")
    private Long materialBatchId;

    @NotNull(message = "数量不能为空")
    private Integer quantity;

    private String applicant;
    private String remark;

    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public Long getMaterialBatchId() { return materialBatchId; }
    public void setMaterialBatchId(Long materialBatchId) { this.materialBatchId = materialBatchId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getApplicant() { return applicant; }
    public void setApplicant(String applicant) { this.applicant = applicant; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
