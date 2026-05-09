package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class OutsourcingOrderRequest {

    @NotNull(message = "供应商ID不能为空")
    private Long supplierId;

    @NotBlank(message = "产品编码不能为空")
    private String productCode;

    @NotBlank(message = "产品名称不能为空")
    private String productName;

    @NotNull(message = "订单数量不能为空")
    @DecimalMin(value = "0.01", message = "订单数量必须大于0")
    private BigDecimal orderQuantity;

    @NotNull(message = "单价不能为空")
    @DecimalMin(value = "0.0001", message = "单价必须大于0")
    private BigDecimal unitPrice;

    @NotNull(message = "订单日期不能为空")
    private LocalDate orderDate;

    private LocalDate deliveryDeadline;

    private String remark;
}
