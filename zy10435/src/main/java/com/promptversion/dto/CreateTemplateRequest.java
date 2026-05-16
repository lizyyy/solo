package com.promptversion.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;

@Data
public class CreateTemplateRequest {
    @NotBlank(message = "模板名称不能为空")
    private String templateName;
    private String description;
    @NotBlank(message = "创建人不能为空")
    private String createdBy;
}