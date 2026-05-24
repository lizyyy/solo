package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CloseRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "结案原因不能为空")
    private String closeReason;
    
    @NotBlank(message = "结案人不能为空")
    private String closedBy;
}
