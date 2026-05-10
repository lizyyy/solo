package com.paymentguard.common.dto;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
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
