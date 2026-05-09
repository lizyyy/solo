package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class DeliveryBatchRequest {

    @NotNull(message = "外协订单ID不能为空")
    private Long orderId;

    @NotNull(message = "到货数量不能为空")
    @DecimalMin(value = "0.01", message = "到货数量必须大于0")
    private BigDecimal deliveryQuantity;

    @NotNull(message = "到货日期不能为空")
    private LocalDate deliveryDate;

    private String deliveryPerson;

    private String waybillNo;

    private String remark;
}
