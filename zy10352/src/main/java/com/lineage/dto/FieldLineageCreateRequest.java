package com.lineage.dto;

import com.lineage.enums.FieldType;
import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
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

    @Valid
    private List<SourceTableDto> sourceTables;

    @Valid
    private CalculationRuleDto calculationRule;

    @Valid
    private List<DependentApiDto> dependentApis;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;
}
