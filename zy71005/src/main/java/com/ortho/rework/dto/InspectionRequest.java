package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InspectionRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "核验结果不能为空")
    private String inspectionResult;
    
    private String inspectionRemark;
    
    @NotBlank(message = "核验人不能为空")
    private String inspectionBy;
}
