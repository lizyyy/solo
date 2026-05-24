package com.hotel.lostfound.dto.response;

import java.time.LocalDateTime;

public class SupplementRecordVO {

    private Long id;

    private String supplementType;

    private String supplementContent;

    private String evidenceImageUrls;

    private String operator;

    private LocalDateTime operateTime;

    private String remark;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSupplementType() {
        return supplementType;
    }

    public void setSupplementType(String supplementType) {
        this.supplementType = supplementType;
    }

    public String getSupplementContent() {
        return supplementContent;
    }

    public void setSupplementContent(String supplementContent) {
        this.supplementContent = supplementContent;
    }

    public String getEvidenceImageUrls() {
        return evidenceImageUrls;
    }

    public void setEvidenceImageUrls(String evidenceImageUrls) {
        this.evidenceImageUrls = evidenceImageUrls;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public LocalDateTime getOperateTime() {
        return operateTime;
    }

    public void setOperateTime(LocalDateTime operateTime) {
        this.operateTime = operateTime;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
