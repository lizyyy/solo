package com.factory.gauge.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class GaugeRegisterRequest {
    @NotBlank(message = "量具编号不能为空")
    private String toolNo;

    @NotBlank(message = "量具名称不能为空")
    private String toolName;

    private String specification;

    @NotBlank(message = "校准证书编号不能为空")
    private String calibrationCertificateNo;

    @NotNull(message = "校准日期不能为空")
    private LocalDate calibrationDate;

    @NotNull(message = "有效期至不能为空")
    private LocalDate validUntilDate;

    private String remarks;

    private String operator;

    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }
    public String getSpecification() { return specification; }
    public void setSpecification(String specification) { this.specification = specification; }
    public String getCalibrationCertificateNo() { return calibrationCertificateNo; }
    public void setCalibrationCertificateNo(String calibrationCertificateNo) { this.calibrationCertificateNo = calibrationCertificateNo; }
    public LocalDate getCalibrationDate() { return calibrationDate; }
    public void setCalibrationDate(LocalDate calibrationDate) { this.calibrationDate = calibrationDate; }
    public LocalDate getValidUntilDate() { return validUntilDate; }
    public void setValidUntilDate(LocalDate validUntilDate) { this.validUntilDate = validUntilDate; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
