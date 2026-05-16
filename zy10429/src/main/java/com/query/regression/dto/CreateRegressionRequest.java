package com.query.regression.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Map;

@Data
public class CreateRegressionRequest {
    @NotBlank(message = "查询名称不能为空")
    private String queryName;
    
    @NotNull(message = "模板ID不能为空")
    private Long templateId;
    
    private Map<String, Object> parameters;
    
    @NotBlank(message = "旧执行计划不能为空")
    private String oldPlan;
    
    @NotBlank(message = "新执行计划不能为空")
    private String newPlan;
    
    private String createdBy;
}
