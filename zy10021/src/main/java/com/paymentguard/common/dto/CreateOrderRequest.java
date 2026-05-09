package com.paymentguard.common.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateOrderRequest {
    
    @NotBlank(message = "商品名称不能为空")
    private String productName;
    
    @NotNull(message = "订单金额不能为空")
    @DecimalMin(value = "0.01", message = "订单金额必须大于0")
    private BigDecimal amount;
    
    private String currency = "CNY";
    
    private String merchantId;
    
    private String notifyUrl;
    
    private String extra;
}
