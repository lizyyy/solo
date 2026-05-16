package com.dependency.license.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePackageRequest {
    @NotBlank(message = "包名不能为空")
    private String name;

    @NotBlank(message = "groupId不能为空")
    private String groupId;

    @NotBlank(message = "artifactId不能为空")
    private String artifactId;

    @NotBlank(message = "当前版本不能为空")
    private String currentVersion;

    @NotBlank(message = "目标版本不能为空")
    private String targetVersion;

    private String description;
    private String changeLog;
    private String category;
}