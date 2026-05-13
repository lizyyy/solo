package com.degrade.drill.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TargetApiDto {
    @NotBlank(message = "接口路径不能为空")
    private String path;

    @NotBlank(message = "请求方法不能为空")
    private String method;

    private String description;
}