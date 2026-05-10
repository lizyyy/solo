package com.paymentguard.common.dto;

import com.paymentguard.common.enums.PaymentStatus;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PaymentCallbackRequest {
    
    @NotBlank(message = "交易号不能为空")
    private String transactionId;
    
    @NotBlank(message = "订单号不能为空")
    private String orderId;
    
    @NotNull(message = "支付金额不能为空")
    private BigDecimal amount;
    
    private String currency = "CNY";
    
    @NotNull(message = "支付状态不能为空")
    private PaymentStatus status;
    
    private String paymentMethod;
    
    private String channelOrderId;
    
    private String bankOrderNo;
    
    private String merchantId;
    
    private String successTime;
    
    private String signature;
    
    private String rawData;
}
