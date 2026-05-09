package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReplenishmentDeliveryRequest {

    @NotNull(message = "到货数量不能为空")
    @DecimalMin(value = "0.01", message = "到货数量必须大于0")
    private BigDecimal receivedQuantity;

    private LocalDate actualDeliveryDate;

    private String remark;
}
