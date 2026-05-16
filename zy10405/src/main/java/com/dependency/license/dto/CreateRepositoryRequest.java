package com.dependency.license.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRepositoryRequest {
    @NotBlank(message = "仓库名称不能为空")
    private String name;

    @NotBlank(message = "仓库URL不能为空")
    private String url;

    private String owner;

    @NotBlank(message = "负责人不能为空")
    private String maintainer;

    @NotBlank(message = "负责人邮箱不能为空")
    private String maintainerEmail;

    private String department;
    private String description;
    private Boolean isActive = true;
}