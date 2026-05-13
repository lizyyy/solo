package com.approval.coordinator.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class BatchCreateRequest {

    @NotBlank(message = "批次ID不能为空")
    private String batchId;

    @NotBlank(message = "业务类型不能为空")
    private String businessType;

    @NotBlank(message = "来源系统不能为空")
    private String sourceSystem;

    private String callbackUrl;

    private String createdBy;

    private String remark;

    private Integer chunkSize;

    @NotEmpty(message = "审批单据不能为空")
    @Size(max = 100, message = "单次提交最多100条")
    private List<ApprovalItemRequest> items;
}
