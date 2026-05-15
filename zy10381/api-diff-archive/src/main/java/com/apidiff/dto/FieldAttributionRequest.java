package com.apidiff.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FieldAttributionRequest {

    @NotNull(message = "差异字段ID不能为空")
    private Long fieldId;

    @NotBlank(message = "归因备注不能为空")
    private String attributionNote;

    private String operatedBy;

    private String remark;
}
