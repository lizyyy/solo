package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MarkLostRequest {
    @NotBlank(message = "快递单号不能为空")
    private String expressNo;
    
    private String lostRemark;
    
    @NotBlank(message = "操作人不能为空")
    private String operator;
}
