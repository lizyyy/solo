package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "复查结果不能为空")
    private String reviewResult;
    
    @NotBlank(message = "复查人不能为空")
    private String reviewBy;
}
