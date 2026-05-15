package com.object.lifecycle.dto;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateRuleRequest {

    @NotBlank(message = "规则ID不能为空")
    private String ruleId;

    @NotBlank(message = "规则名称不能为空")
    private String ruleName;

    private String description;

    @NotNull(message = "对象前缀ID不能为空")
    private Long prefixId;

    @Min(value = 0, message = "归档天数不能为负数")
    private Integer archiveAfterDays;

    @Min(value = 0, message = "删除天数不能为负数")
    private Integer deleteAfterDays;

    private String storageClass;
}
