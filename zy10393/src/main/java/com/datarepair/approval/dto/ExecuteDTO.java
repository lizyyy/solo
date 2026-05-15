package com.datarepair.approval.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class ExecuteDTO {

    @NotNull(message = "脚本ID不能为空")
    private Long scriptId;

    private String operator;

    private String remark;

    @NotNull(message = "请求ID不能为空")
    private String requestId;
}
