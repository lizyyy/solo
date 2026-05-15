package com.lineage.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class DependentApiDto {

    @NotBlank(message = "依赖 API 路径不能为空")
    private String apiPath;

    @NotBlank(message = "依赖 API 方法不能为空")
    private String apiMethod;

    private String apiName;

    @NotBlank(message = "依赖 API 响应字段不能为空")
    private String responseField;

    private String description;
}
