package com.manufacture.outsourcing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SupplierReport {

    private Long supplierId;
    private String supplierCode;
    private String supplierName;

    private Long totalOrders;
    private Long completedOrders;
    private Long pendingOrders;

    private BigDecimal totalOrderQuantity;
    private BigDecimal totalDeliveredQuantity;
    private BigDecimal totalQualifiedQuantity;
    private BigDecimal totalUnqualifiedQuantity;

    private BigDecimal totalDeductionAmount;

    private Long totalReplenishmentTasks;
    private Long completedReplenishmentTasks;
    private BigDecimal totalReplenishmentQuantity;
    private BigDecimal receivedReplenishmentQuantity;

    private BigDecimal qualifiedRate;
    private BigDecimal deductionRate;
    private BigDecimal onTimeDeliveryRate;
}
