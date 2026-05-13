package com.example.readonlywindow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateWriteRequest {
    @NotBlank(message = "窗口编码不能为空")
    private String windowCode;

    @NotBlank(message = "请求人不能为空")
    private String requester;

    @NotBlank(message = "资源类型不能为空")
    private String resourceType;

    @NotBlank(message = "资源名称不能为空")
    private String resourceName;

    private String operationDetails;

    private String justification;

    private String operator;
}
