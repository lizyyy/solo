package com.lineage.dto;

import com.lineage.enums.FieldType;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class FieldLineageCreateRequest {

    @NotBlank(message = "API路径不能为空")
    private String apiPath;

    @NotBlank(message = "API方法不能为空")
    private String apiMethod;

    private String apiName;

    @NotBlank(message = "响应字段不能为空")
    private String responseField;

    private String fieldPath;

    private FieldType fieldType;

    private String description;

    private String exampleValue;

    private List<SourceTableDto> sourceTables;

    private CalculationRuleDto calculationRule;

    private List<DependentApiDto> dependentApis;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;
}
