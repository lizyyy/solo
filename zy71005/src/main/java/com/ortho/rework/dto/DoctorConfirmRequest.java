package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DoctorConfirmRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "医生确认意见不能为空")
    private String doctorConfirmation;
    
    @NotBlank(message = "医生姓名不能为空")
    private String doctorName;
}
