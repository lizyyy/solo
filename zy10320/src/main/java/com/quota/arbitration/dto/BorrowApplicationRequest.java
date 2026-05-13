package com.quota.arbitration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BorrowApplicationRequest {
    @NotBlank(message = "申请编号不能为空")
    private String applicationNo;

    @NotBlank(message = "客户ID不能为空")
    private String customerId;

    private String customerName;

    @NotBlank(message = "共享池编码不能为空")
    private String poolCode;

    @NotNull(message = "申请金额不能为空")
    @Positive(message = "申请金额必须大于0")
    private BigDecimal requestAmount;

    @NotNull(message = "借用天数不能为空")
    @Positive(message = "借用天数必须大于0")
    private Integer borrowDays;

    private String borrowReason;

    private String applicant;

    private String idempotentKey;
}
