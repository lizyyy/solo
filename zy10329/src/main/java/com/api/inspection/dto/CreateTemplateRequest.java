package com.api.inspection.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CreateTemplateRequest {
    @NotBlank(message = "模板编码不能为空")
    private String templateCode;

    @NotBlank(message = "模板名称不能为空")
    private String templateName;

    private String description;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    @NotEmpty(message = "步骤列表不能为空")
    @Valid
    private List<StepRequest> steps;
}
