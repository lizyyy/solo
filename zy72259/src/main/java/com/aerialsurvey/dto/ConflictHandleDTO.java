package com.aerialsurvey.dto;

import com.aerialsurvey.enums.ConflictStatus;
import jakarta.validation.constraints.NotNull;

public class ConflictHandleDTO {
    @NotNull(message = "冲突记录ID不能为空")
    private Long conflictId;

    @NotNull(message = "处理状态不能为空")
    private ConflictStatus status;

    private String handlingRemark;

    @NotNull(message = "处理人不能为空")
    private String handledBy;

    public Long getConflictId() {
        return conflictId;
    }

    public void setConflictId(Long conflictId) {
        this.conflictId = conflictId;
    }

    public ConflictStatus getStatus() {
        return status;
    }

    public void setStatus(ConflictStatus status) {
        this.status = status;
    }

    public String getHandlingRemark() {
        return handlingRemark;
    }

    public void setHandlingRemark(String handlingRemark) {
        this.handlingRemark = handlingRemark;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    @Override
    public String toString() {
        return "ConflictHandleDTO{" +
                "conflictId=" + conflictId +
                ", status=" + status +
                ", handlingRemark='" + handlingRemark + '\'' +
                ", handledBy='" + handledBy + '\'' +
                '}';
    }
}
