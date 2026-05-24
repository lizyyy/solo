package com.factory.gauge.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class CalibrationReportRequest {
    @NotBlank(message = "量具编号不能为空")
    private String toolNo;

    @NotBlank(message = "证书编号不能为空")
    private String certificateNo;

    @NotNull(message = "校准日期不能为空")
    private LocalDate calibrationDate;

    @NotNull(message = "有效期至不能为空")
    private LocalDate validUntilDate;

    private String calibrationAgency;

    private String calibrator;

    private String calibrationItems;

    private String calibrationResult;

    @NotNull(message = "是否通过不能为空")
    private Boolean isPassed = true;

    private String fileUrl;

    private String remarks;

    private String operator;

    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getCertificateNo() { return certificateNo; }
    public void setCertificateNo(String certificateNo) { this.certificateNo = certificateNo; }
    public LocalDate getCalibrationDate() { return calibrationDate; }
    public void setCalibrationDate(LocalDate calibrationDate) { this.calibrationDate = calibrationDate; }
    public LocalDate getValidUntilDate() { return validUntilDate; }
    public void setValidUntilDate(LocalDate validUntilDate) { this.validUntilDate = validUntilDate; }
    public String getCalibrationAgency() { return calibrationAgency; }
    public void setCalibrationAgency(String calibrationAgency) { this.calibrationAgency = calibrationAgency; }
    public String getCalibrator() { return calibrator; }
    public void setCalibrator(String calibrator) { this.calibrator = calibrator; }
    public String getCalibrationItems() { return calibrationItems; }
    public void setCalibrationItems(String calibrationItems) { this.calibrationItems = calibrationItems; }
    public String getCalibrationResult() { return calibrationResult; }
    public void setCalibrationResult(String calibrationResult) { this.calibrationResult = calibrationResult; }
    public Boolean getIsPassed() { return isPassed; }
    public void setIsPassed(Boolean isPassed) { this.isPassed = isPassed; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
