package com.hotel.lostfound.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class SupplementRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotBlank(message = "补充类型不能为空")
    private String supplementType;

    private String supplementContent;

    private String evidenceImageUrls;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotNull(message = "操作时间不能为空")
    private LocalDateTime operateTime;

    private String remark;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
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
