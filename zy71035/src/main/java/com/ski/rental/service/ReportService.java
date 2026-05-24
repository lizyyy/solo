package com.ski.rental.service;

import com.ski.rental.dto.ApiResponse;
import com.ski.rental.model.*;
import com.ski.rental.repository.RentalOrderRepository;
import com.ski.rental.repository.ReturnInspectionRepository;
import com.ski.rental.repository.SafetyReportRepository;
import com.ski.rental.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {
    private final SafetyReportRepository safetyReportRepository;
    private final RentalOrderRepository rentalOrderRepository;
    private final ReturnInspectionRepository returnInspectionRepository;
    private final AuditLogRepository auditLogRepository;

    public ReportService(SafetyReportRepository safetyReportRepository,
                         RentalOrderRepository rentalOrderRepository,
                         ReturnInspectionRepository returnInspectionRepository,
                         AuditLogRepository auditLogRepository) {
        this.safetyReportRepository = safetyReportRepository;
        this.rentalOrderRepository = rentalOrderRepository;
        this.returnInspectionRepository = returnInspectionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    private static final DateTimeFormatter REPORT_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Transactional
    public ApiResponse<SafetyReport> generateSafetyReport(String orderNo, String operator) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        SafetyReport report = new SafetyReport();
        report.setReportNo("RPT" + LocalDateTime.now().format(REPORT_NO_FORMAT) +
            String.format("%04d", new Random().nextInt(10000)));
        report.setRentalOrder(order);
        report.setGeneratedBy(operator);

        report.setParamsCompliant(order.getParamsValidated());
        report.setParamsCheckSummary(order.getParamsValidationNote());

        Optional<ReturnInspection> inspection = returnInspectionRepository.findByRentalOrderOrderNo(orderNo);
        if (inspection.isPresent()) {
            report.setReturnInspectionComplete(inspection.get().getReviewed());
            report.setReturnInspectionSummary("损伤等级: " + inspection.get().getOverallDamageLevel() +
                ", 定损费用: " + inspection.get().getFinalDamageFee());
        } else {
            report.setReturnInspectionComplete(false);
            report.setReturnInspectionSummary("未进行归还检查");
        }

        report.setFeeCleared(order.getFeePaid());
        report.setFeeSummary("租赁费: " + order.getRentalFee() +
            ", 损伤费: " + order.getDamageFee() +
            ", 总计: " + order.getTotalFee() +
            ", 已支付: " + (order.getFeePaid() ? "是" : "否"));

        boolean allClear = order.getParamsValidated() &&
            (inspection.isPresent() && inspection.get().getReviewed()) &&
            order.getFeePaid();
        report.setOverallStatus(allClear ? "安全" : "异常");
        report.setReportSummary(generateSummary(order, inspection.orElse(null)));

        report = safetyReportRepository.save(report);
        return ApiResponse.ok("安全报告生成成功", report);
    }

    private String generateSummary(RentalOrder order, ReturnInspection inspection) {
        StringBuilder sb = new StringBuilder();
        sb.append("订单").append(order.getOrderNo()).append("安全报告: ");

        List<String> issues = new ArrayList<>();
        if (!order.getParamsValidated()) {
            issues.add("参数校验不通过");
        }
        if (inspection == null || !inspection.getReviewed()) {
            issues.add("未完成归还检查复核");
        }
        if (!order.getFeePaid()) {
            issues.add("费用未结清");
        }

        if (issues.isEmpty()) {
            sb.append("所有检查项通过，可正常归档");
        } else {
            sb.append("存在问题: ").append(String.join("; ", issues));
        }
        return sb.toString();
    }

    public ApiResponse<Map<String, Object>> exportBatchReport(String batchNo) {
        List<RentalOrder> orders = rentalOrderRepository.findByBatchNo(batchNo);
        if (orders.isEmpty()) {
            return ApiResponse.error("批次不存在: " + batchNo);
        }

        Map<String, Object> report = new HashMap<>();
        report.put("batchNo", batchNo);
        report.put("generatedAt", LocalDateTime.now().toString());
        report.put("totalOrders", orders.size());

        Map<String, Long> statusCounts = orders.stream()
            .collect(Collectors.groupingBy(o -> o.getStatus().name(), Collectors.counting()));
        report.put("statusDistribution", statusCounts);

        long exceptionCount = orders.stream().filter(RentalOrder::getIsException).count();
        report.put("exceptionCount", exceptionCount);
        report.put("normalCount", orders.size() - exceptionCount);

        report.put("totalRentalFee", orders.stream()
            .map(o -> o.getRentalFee() != null ? o.getRentalFee() : java.math.BigDecimal.ZERO)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
        report.put("totalDamageFee", orders.stream()
            .map(o -> o.getDamageFee() != null ? o.getDamageFee() : java.math.BigDecimal.ZERO)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
        report.put("totalFee", orders.stream()
            .map(o -> o.getTotalFee() != null ? o.getTotalFee() : java.math.BigDecimal.ZERO)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));

        List<Map<String, Object>> orderDetails = orders.stream().map(order -> {
            Map<String, Object> detail = new HashMap<>();
            detail.put("orderNo", order.getOrderNo());
            detail.put("customerName", order.getCustomer().getName());
            detail.put("boardCode", order.getSnowboard().getBoardCode());
            detail.put("status", order.getStatus());
            detail.put("isException", order.getIsException());
            detail.put("exceptionType", order.getExceptionType());
            detail.put("totalFee", order.getTotalFee());
            detail.put("feePaid", order.getFeePaid());
            return detail;
        }).toList();
        report.put("orderDetails", orderDetails);

        List<AuditLog> auditLogs = auditLogRepository.findByBatchNoOrderByCreatedAtDesc(batchNo);
        report.put("auditTrail", auditLogs.stream().map(log -> {
            Map<String, Object> auditMap = new HashMap<>();
            auditMap.put("action", log.getAction());
            auditMap.put("orderNo", log.getOrderNo());
            auditMap.put("operator", log.getOperator());
            auditMap.put("beforeState", log.getBeforeState());
            auditMap.put("afterState", log.getAfterState());
            auditMap.put("note", log.getNote());
            auditMap.put("isDuplicate", log.getIsDuplicate());
            auditMap.put("createdAt", log.getCreatedAt());
            return auditMap;
        }).toList());

        return ApiResponse.ok("批次报告导出成功", report);
    }

    public ApiResponse<Map<String, Object>> exportOrderDetail(String orderNo) {
        RentalOrder order = rentalOrderRepository.findByOrderNo(orderNo)
            .orElseThrow(() -> new RuntimeException("订单不存在: " + orderNo));

        Map<String, Object> detail = new HashMap<>();
        detail.put("orderNo", order.getOrderNo());
        detail.put("batchNo", order.getBatchNo());
        detail.put("status", order.getStatus());
        detail.put("operator", order.getOperator());
        detail.put("createdAt", order.getCreatedAt());

        Map<String, Object> customer = new HashMap<>();
        customer.put("customerId", order.getCustomer().getCustomerId());
        customer.put("name", order.getCustomer().getName());
        customer.put("heightCm", order.getCustomer().getHeightCm());
        customer.put("weightKg", order.getCustomer().getWeightKg());
        customer.put("bootSize", order.getCustomer().getBootSize());
        customer.put("preferredReleaseValue", order.getCustomer().getPreferredReleaseValue());
        detail.put("customer", customer);

        Map<String, Object> snowboard = new HashMap<>();
        snowboard.put("boardCode", order.getSnowboard().getBoardCode());
        snowboard.put("brand", order.getSnowboard().getBrand());
        snowboard.put("model", order.getSnowboard().getModel());
        snowboard.put("lengthCm", order.getSnowboard().getLengthCm());
        if (order.getSnowboard().getBindingSpec() != null) {
            snowboard.put("bindingModel", order.getSnowboard().getBindingSpec().getBindingModel());
            snowboard.put("minReleaseValue", order.getSnowboard().getBindingSpec().getMinReleaseValue());
            snowboard.put("maxReleaseValue", order.getSnowboard().getBindingSpec().getMaxReleaseValue());
        }
        detail.put("snowboard", snowboard);

        detail.put("actualReleaseValue", order.getActualReleaseValue());
        detail.put("paramsValidated", order.getParamsValidated());
        detail.put("paramsValidationNote", order.getParamsValidationNote());

        detail.put("rentalFee", order.getRentalFee());
        detail.put("damageFee", order.getDamageFee());
        detail.put("totalFee", order.getTotalFee());
        detail.put("feePaid", order.getFeePaid());

        detail.put("isException", order.getIsException());
        detail.put("exceptionType", order.getExceptionType());
        detail.put("exceptionNote", order.getExceptionNote());

        Optional<ReturnInspection> inspection = returnInspectionRepository.findByRentalOrderOrderNo(orderNo);
        if (inspection.isPresent()) {
            Map<String, Object> insp = new HashMap<>();
            insp.put("overallDamageLevel", inspection.get().getOverallDamageLevel());
            insp.put("estimatedDamageFee", inspection.get().getEstimatedDamageFee());
            insp.put("finalDamageFee", inspection.get().getFinalDamageFee());
            insp.put("reviewed", inspection.get().getReviewed());
            insp.put("reviewNote", inspection.get().getReviewNote());
            detail.put("returnInspection", insp);
        }

        List<AuditLog> auditLogs = auditLogRepository.findByOrderNoOrderByCreatedAtDesc(orderNo);
        detail.put("auditTrail", auditLogs.stream().map(log -> {
            Map<String, Object> auditMap = new HashMap<>();
            auditMap.put("action", log.getAction());
            auditMap.put("operator", log.getOperator());
            auditMap.put("beforeState", log.getBeforeState());
            auditMap.put("afterState", log.getAfterState());
            auditMap.put("note", log.getNote());
            auditMap.put("isDuplicate", log.getIsDuplicate());
            auditMap.put("createdAt", log.getCreatedAt());
            return auditMap;
        }).toList());

        return ApiResponse.ok("订单详情导出成功", detail);
    }

    public ApiResponse<List<SafetyReport>> getReportsByOrder(String orderNo) {
        return safetyReportRepository.findByRentalOrderOrderNo(orderNo)
            .map(report -> ApiResponse.ok(Collections.singletonList(report)))
            .orElse(ApiResponse.ok(Collections.emptyList()));
    }
}
