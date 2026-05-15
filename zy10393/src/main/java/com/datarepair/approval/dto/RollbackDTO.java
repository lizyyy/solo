package com.datarepair.approval.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class RollbackDTO {

    @NotNull(message = "脚本ID不能为空")
    private Long scriptId;

    @NotNull(message = "执行批次ID不能为空")
    private Long executionBatchId;

    private String rollbackScript;

    @NotBlank(message = "回滚证明不能为空")
    private String rollbackProof;

    private String operator;

    private String remark;

    @NotNull(message = "请求ID不能为空")
    private String requestId;
}
