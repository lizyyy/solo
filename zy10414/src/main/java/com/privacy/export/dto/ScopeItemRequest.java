package com.privacy.export.dto;

import com.privacy.export.enums.ExportScopeCategory;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ScopeItemRequest {

    @NotNull(message = "范围类别不能为空")
    private ExportScopeCategory category;

    @NotBlank(message = "字段名称不能为空")
    private String fieldName;

    private String fieldDescription;

    private Boolean isIncluded = true;
}
