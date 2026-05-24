package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;

public class TransferRecordRequest {
    @NotNull(message = "安置点ID不能为空")
    private Long shelterId;

    @NotNull(message = "总人数不能为空")
    private Integer totalCount;

    private Integer elderlyCount;
    private Integer childrenCount;
    private Integer disabledCount;
    private String reporter;
    private String remark;

    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public Integer getTotalCount() { return totalCount; }
    public void setTotalCount(Integer totalCount) { this.totalCount = totalCount; }
    public Integer getElderlyCount() { return elderlyCount; }
    public void setElderlyCount(Integer elderlyCount) { this.elderlyCount = elderlyCount; }
    public Integer getChildrenCount() { return childrenCount; }
    public void setChildrenCount(Integer childrenCount) { this.childrenCount = childrenCount; }
    public Integer getDisabledCount() { return disabledCount; }
    public void setDisabledCount(Integer disabledCount) { this.disabledCount = disabledCount; }
    public String getReporter() { return reporter; }
    public void setReporter(String reporter) { this.reporter = reporter; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
