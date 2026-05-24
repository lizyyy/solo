package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualConfirmRequest {
    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotNull(message = "确认结果不能为空")
    private Boolean confirmed;

    private String remark;

    private String targetStatus;
}
