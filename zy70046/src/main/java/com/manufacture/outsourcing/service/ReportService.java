package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.SupplierReport;
import com.manufacture.outsourcing.entity.*;
import com.manufacture.outsourcing.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class ReportService {

    private final SupplierRepository supplierRepository;
    private final OutsourcingOrderRepository orderRepository;
    private final DeliveryBatchRepository batchRepository;
    private final InspectionResultRepository inspectionRepository;
    private final DeductionRecordRepository deductionRepository;
    private final ReplenishmentTaskRepository replenishmentRepository;

    public ReportService(SupplierRepository supplierRepository,
                         OutsourcingOrderRepository orderRepository,
                         DeliveryBatchRepository batchRepository,
                         InspectionResultRepository inspectionRepository,
                         DeductionRecordRepository deductionRepository,
                         ReplenishmentTaskRepository replenishmentRepository) {
        this.supplierRepository = supplierRepository;
        this.orderRepository = orderRepository;
        this.batchRepository = batchRepository;
        this.inspectionRepository = inspectionRepository;
        this.deductionRepository = deductionRepository;
        this.replenishmentRepository = replenishmentRepository;
    }

    public List<SupplierReport> generateSupplierReports() {
        List<Supplier> suppliers = supplierRepository.findAll();
        List<SupplierReport> reports = new ArrayList<>();

        for (Supplier supplier : suppliers) {
            reports.add(generateSupplierReport(supplier));
        }

        return reports;
    }

    public SupplierReport generateSupplierReport(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new RuntimeException("供应商不存在"));
        return generateSupplierReport(supplier);
    }

    private SupplierReport generateSupplierReport(Supplier supplier) {
        List<OutsourcingOrder> orders = orderRepository.findBySupplierId(supplier.getId());

        SupplierReport report = new SupplierReport();
        report.setSupplierId(supplier.getId());
        report.setSupplierCode(supplier.getSupplierCode());
        report.setSupplierName(supplier.getSupplierName());

        report.setTotalOrders((long) orders.size());
        report.setCompletedOrders(orders.stream()
                .filter(o -> List.of(
                        OutsourcingOrder.STATUS_COMPLETED,
                        OutsourcingOrder.STATUS_CLOSED
                ).contains(o.getOrderStatus()))
                .count());
        report.setPendingOrders(orders.stream()
                .filter(o -> !List.of(
                        OutsourcingOrder.STATUS_COMPLETED,
                        OutsourcingOrder.STATUS_CLOSED
                ).contains(o.getOrderStatus()))
                .count());

        report.setTotalOrderQuantity(orders.stream()
                .map(OutsourcingOrder::getOrderQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        report.setTotalDeliveredQuantity(orders.stream()
                .map(OutsourcingOrder::getDeliveredQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        report.setTotalQualifiedQuantity(orders.stream()
                .map(OutsourcingOrder::getQualifiedQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        report.setTotalUnqualifiedQuantity(orders.stream()
                .map(OutsourcingOrder::getUnqualifiedQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        report.setTotalDeductionAmount(orders.stream()
                .map(OutsourcingOrder::getDeductionAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        List<ReplenishmentTask> replenishments = replenishmentRepository.findBySupplierId(supplier.getId());
        report.setTotalReplenishmentTasks((long) replenishments.size());
        report.setCompletedReplenishmentTasks(replenishments.stream()
                .filter(r -> ReplenishmentTask.STATUS_COMPLETED.equals(r.getTaskStatus()))
                .count());
        report.setTotalReplenishmentQuantity(replenishments.stream()
                .filter(r -> !ReplenishmentTask.STATUS_CANCELLED.equals(r.getTaskStatus()))
                .map(ReplenishmentTask::getRequiredQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        report.setReceivedReplenishmentQuantity(replenishments.stream()
                .map(ReplenishmentTask::getReceivedQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        if (report.getTotalDeliveredQuantity().compareTo(BigDecimal.ZERO) > 0) {
            report.setQualifiedRate(report.getTotalQualifiedQuantity()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(report.getTotalDeliveredQuantity(), 2, RoundingMode.HALF_UP));
        } else {
            report.setQualifiedRate(BigDecimal.ZERO);
        }

        BigDecimal totalOrderAmount = orders.stream()
                .map(OutsourcingOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalOrderAmount.compareTo(BigDecimal.ZERO) > 0) {
            report.setDeductionRate(report.getTotalDeductionAmount()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(totalOrderAmount, 2, RoundingMode.HALF_UP));
        } else {
            report.setDeductionRate(BigDecimal.ZERO);
        }

        report.setOnTimeDeliveryRate(calculateOnTimeRate(orders));

        return report;
    }

    private BigDecimal calculateOnTimeRate(List<OutsourcingOrder> orders) {
        if (orders.isEmpty()) {
            return BigDecimal.ZERO;
        }

        long onTimeCount = orders.stream()
                .filter(o -> {
                    if (o.getDeliveryDeadline() == null) return true;
                    List<DeliveryBatch> batches = batchRepository.findByOrderId(o.getId());
                    if (batches.isEmpty()) return false;
                    return batches.stream()
                            .allMatch(b -> !b.getDeliveryDate().isAfter(o.getDeliveryDeadline()));
                })
                .count();

        return BigDecimal.valueOf(onTimeCount * 100.0 / orders.size())
                .setScale(2, RoundingMode.HALF_UP);
    }
}
