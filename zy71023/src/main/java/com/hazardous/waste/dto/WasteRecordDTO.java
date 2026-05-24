package com.hazardous.waste.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public class WasteRecordDTO {
    private String recordNo;

    @NotBlank(message = "危废类别不能为空")
    private String category;

    @NotBlank(message = "危废名称不能为空")
    private String wasteName;

    @NotNull(message = "重量不能为空")
    private Double weight;

    private String component;

    private String hazardCharacteristics;

    private String bucketCode;

    private LocalDateTime inTime;

    private String submitter;

    private String remark;

    public String getRecordNo() { return recordNo; }
    public void setRecordNo(String recordNo) { this.recordNo = recordNo; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getWasteName() { return wasteName; }
    public void setWasteName(String wasteName) { this.wasteName = wasteName; }
    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }
    public String getComponent() { return component; }
    public void setComponent(String component) { this.component = component; }
    public String getHazardCharacteristics() { return hazardCharacteristics; }
    public void setHazardCharacteristics(String hazardCharacteristics) { this.hazardCharacteristics = hazardCharacteristics; }
    public String getBucketCode() { return bucketCode; }
    public void setBucketCode(String bucketCode) { this.bucketCode = bucketCode; }
    public LocalDateTime getInTime() { return inTime; }
    public void setInTime(LocalDateTime inTime) { this.inTime = inTime; }
    public String getSubmitter() { return submitter; }
    public void setSubmitter(String submitter) { this.submitter = submitter; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
