package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateReworkRequest {
    @NotBlank(message = "患者编号不能为空")
    private String patientNo;
    
    private String patientName;
    
    private String patientPhone;
    
    private String doctorName;
    
    @NotBlank(message = "批次号不能为空")
    private String batchNo;
    
    private String impressionType;
    
    @NotBlank(message = "返工原因不能为空")
    private String reworkReason;
    
    private String operator;
}
