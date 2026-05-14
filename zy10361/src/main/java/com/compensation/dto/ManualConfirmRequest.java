package com.compensation.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ManualConfirmRequest {

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String remark;
}
