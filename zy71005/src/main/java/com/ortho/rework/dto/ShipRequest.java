package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ShipRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "快递单号不能为空")
    private String expressNo;
    
    private String expressCompany;
    
    @NotBlank(message = "寄件人不能为空")
    private String shippedBy;
    
    private String receiver;
    
    private String receiverPhone;
}
