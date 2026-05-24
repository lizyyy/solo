package com.factory.gauge.dto.request;

import com.factory.gauge.entity.enums.ReinspectionResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ReinspectionRequest {
    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotNull(message = "复检结果不能为空")
    private ReinspectionResult result;

    private String inspectionDetail;

    private String defectDescription;

    @NotBlank(message = "检验员不能为空")
    private String inspector;

    private String remarks;

    private String operator;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public ReinspectionResult getResult() { return result; }
    public void setResult(ReinspectionResult result) { this.result = result; }
    public String getInspectionDetail() { return inspectionDetail; }
    public void setInspectionDetail(String inspectionDetail) { this.inspectionDetail = inspectionDetail; }
    public String getDefectDescription() { return defectDescription; }
    public void setDefectDescription(String defectDescription) { this.defectDescription = defectDescription; }
    public String getInspector() { return inspector; }
    public void setInspector(String inspector) { this.inspector = inspector; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
