package com.datarepair.approval.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class SubmitDTO {

    @NotNull(message = "脚本ID不能为空")
    private Long scriptId;

    private String operator;

    @NotBlank(message = "请求ID不能为空（用于幂等性校验）")
    private String requestId;
}
