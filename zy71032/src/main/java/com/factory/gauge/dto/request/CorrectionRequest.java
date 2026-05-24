package com.factory.gauge.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CorrectionRequest {
    @NotNull(message = "复检记录ID不能为空")
    private Long recordId;

    @NotBlank(message = "修正人不能为空")
    private String correctedBy;

    private String correctionRemark;

    private String operator;

    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }
    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public String getCorrectionRemark() { return correctionRemark; }
    public void setCorrectionRemark(String correctionRemark) { this.correctionRemark = correctionRemark; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
