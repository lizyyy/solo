package com.package.repo.model.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreatePackageRequest {
    @NotBlank(message = "包名不能为空")
    private String packageName;

    @NotBlank(message = "版本号不能为空")
    private String version;

    @NotBlank(message = "发布人不能为空")
    private String publisher;

    private String description;

    private List<String> dependencyProjects;

    private String rawInput;
}
