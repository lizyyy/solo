package com.paymentguard.reporting.detector;

import com.paymentguard.common.enums.*;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import com.paymentguard.payment.entity.CallbackRecord;
import com.paymentguard.payment.entity.PaymentTransaction;
import com.paymentguard.payment.service.PaymentCallbackService;
import com.paymentguard.reporting.detector.IssueReport.IssueDetail;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IssueDetector {

    private final OrderService orderService;
    private final PaymentCallbackService callbackService;
    
    private final Map<String, IssueReport> issueReports = new ConcurrentHashMap<>();

    public IssueReport detectIssues(String orderId) {
        Order order;
        try {
            order = orderService.getOrder(orderId);
        } catch (Exception e) {
            log.error("Order not found for issue detection: orderId={}", orderId);
            return null;
        }

        String reportId = "RPT_" + orderId + "_" + System.currentTimeMillis();
        IssueReport report = IssueReport.builder()
                .reportId(reportId)
                .orderId(orderId)
                .generatedAt(LocalDateTime.now())
                .issues(new ArrayList<IssueDetail>())
                .orderDetails(order)
                .build();

        List<PaymentTransaction> transactions = callbackService.getTransactionsByOrder(orderId);
        List<CallbackRecord> callbacks = callbackService.getCallbacksByOrder(orderId);
        
        report.setTransactionCount(transactions.size());
        report.setCallbackCount(callbacks.size());

        detectDuplicatePayments(report, order, transactions);
        detectOrderStatusInconsistency(report, order, transactions);
        detectDuplicateCallbacks(report, callbacks);
        detectCallbackTimeout(report, callbacks);
        detectAmountMismatch(report, order, transactions);

        if (!report.getIssues().isEmpty()) {
            issueReports.put(reportId, report);
            log.warn("Issues detected for order: orderId={}, issueCount={}", orderId, report.getIssues().size());
        }

        return report;
    }

    private void detectDuplicatePayments(IssueReport report, Order order, List<PaymentTransaction> transactions) {
        List<PaymentTransaction> successTransactions = transactions.stream()
                .filter(t -> t.getStatus() == PaymentStatus.SUCCESS)
                .collect(Collectors.toList());

        if (successTransactions.size() > 1) {
            List<Map<String, Object>> transactionList = new ArrayList<>();
            for (PaymentTransaction t : successTransactions) {
                Map<String, Object> txMap = new HashMap<>();
                txMap.put("transactionId", t.getTransactionId());
                txMap.put("amount", t.getAmount().toString());
                txMap.put("createdAt", t.getCreatedAt());
                transactionList.add(txMap);
            }

            Map<String, Object> relatedData = new HashMap<>();
            relatedData.put("successCount", successTransactions.size());
            relatedData.put("paymentCount", order.getPaymentCount());
            relatedData.put("transactions", transactionList);

            IssueDetail issue = IssueDetail.builder()
                    .issueType(IssueType.DUPLICATE_PAYMENT)
                    .severity(IssueSeverity.CRITICAL)
                    .title("重复扣款检测")
                    .description(String.format("订单存在 %d 次成功支付记录", successTransactions.size()))
                    .occurredAt(LocalDateTime.now())
                    .affectedEntity("Order: " + order.getOrderId())
                    .relatedData(relatedData)
                    .suggestedAction("检查支付流水，确认是否存在重复扣款。如果存在，发起退款流程。")
                    .build();
            report.getIssues().add(issue);
        }
    }

    private void detectOrderStatusInconsistency(IssueReport report, Order order, 
                                                 List<PaymentTransaction> transactions) {
        List<PaymentTransaction> successTransactions = transactions.stream()
                .filter(t -> t.getStatus() == PaymentStatus.SUCCESS)
                .collect(Collectors.toList());

        boolean hasSuccessPayment = !successTransactions.isEmpty();
        boolean orderIsPaid = order.getStatus() == OrderStatus.PAID;

        if (hasSuccessPayment && !orderIsPaid) {
            Map<String, Object> relatedData = new HashMap<>();
            relatedData.put("orderStatus", order.getStatus().name());
            relatedData.put("orderStatusDesc", order.getStatus().getDescription());
            relatedData.put("successTransactionCount", successTransactions.size());

            IssueDetail issue = IssueDetail.builder()
                    .issueType(IssueType.ORDER_STATUS_INCONSISTENCY)
                    .severity(IssueSeverity.HIGH)
                    .title("订单状态不一致")
                    .description(String.format("存在成功支付记录(%d次)，但订单状态为 %s",
                            successTransactions.size(), order.getStatus().getDescription()))
                    .occurredAt(LocalDateTime.now())
                    .affectedEntity("Order: " + order.getOrderId())
                    .relatedData(relatedData)
                    .suggestedAction("检查订单状态流转，可能需要手动更新订单状态。")
                    .build();
            report.getIssues().add(issue);
        }

        if (!hasSuccessPayment && orderIsPaid) {
            Map<String, Object> relatedData = new HashMap<>();
            relatedData.put("orderStatus", order.getStatus().name());
            relatedData.put("successTransactionCount", 0);

            IssueDetail issue = IssueDetail.builder()
                    .issueType(IssueType.ORDER_STATUS_INCONSISTENCY)
                    .severity(IssueSeverity.HIGH)
                    .title("订单状态不一致")
                    .description("订单状态为已支付，但没有找到成功的支付记录")
                    .occurredAt(LocalDateTime.now())
                    .affectedEntity("Order: " + order.getOrderId())
                    .relatedData(relatedData)
                    .suggestedAction("核实支付记录，可能存在数据丢失或状态误更新。")
                    .build();
            report.getIssues().add(issue);
        }
    }

    private void detectDuplicateCallbacks(IssueReport report, List<CallbackRecord> callbacks) {
        Map<String, List<CallbackRecord>> callbackByTransaction = callbacks.stream()
                .collect(Collectors.groupingBy(CallbackRecord::getTransactionId));

        for (Map.Entry<String, List<CallbackRecord>> entry : callbackByTransaction.entrySet()) {
            String transactionId = entry.getKey();
            List<CallbackRecord> records = entry.getValue();

            if (records.size() > 1) {
                long duplicateCount = records.stream().filter(CallbackRecord::getIsDuplicate).count();
                
                List<Map<String, Object>> callbackList = new ArrayList<>();
                for (CallbackRecord r : records) {
                    Map<String, Object> cbMap = new HashMap<>();
                    cbMap.put("callbackId", r.getCallbackId());
                    cbMap.put("status", r.getStatus().name());
                    cbMap.put("isDuplicate", r.getIsDuplicate());
                    cbMap.put("createdAt", r.getCreatedAt());
                    callbackList.add(cbMap);
                }

                Map<String, Object> relatedData = new HashMap<>();
                relatedData.put("transactionId", transactionId);
                relatedData.put("totalCallbacks", records.size());
                relatedData.put("duplicateCallbacks", duplicateCount);
                relatedData.put("callbacks", callbackList);
                
                IssueDetail issue = IssueDetail.builder()
                        .issueType(IssueType.IDEMPOTENCY_FAILURE)
                        .severity(duplicateCount > 0 ? IssueSeverity.LOW : IssueSeverity.MEDIUM)
                        .title("重复回调检测")
                        .description(String.format("交易 %s 收到 %d 次回调，其中 %d 次被识别为重复",
                                transactionId, records.size(), duplicateCount))
                        .occurredAt(records.get(0).getCreatedAt())
                        .affectedEntity("Transaction: " + transactionId)
                        .relatedData(relatedData)
                        .suggestedAction(duplicateCount > 0 
                                ? "幂等性机制正常工作，重复回调已被拦截。" 
                                : "幂等性校验可能失效，请检查幂等键和分布式锁配置。")
                        .build();
                report.getIssues().add(issue);
            }
        }
    }

    private void detectCallbackTimeout(IssueReport report, List<CallbackRecord> callbacks) {
        long timeoutThreshold = 5000;
        List<CallbackRecord> slowCallbacks = callbacks.stream()
                .filter(r -> r.getProcessingTimeMs() != null && r.getProcessingTimeMs() > timeoutThreshold)
                .collect(Collectors.toList());

        if (!slowCallbacks.isEmpty()) {
            long maxProcessingTime = 0;
            for (CallbackRecord r : slowCallbacks) {
                if (r.getProcessingTimeMs() != null && r.getProcessingTimeMs() > maxProcessingTime) {
                    maxProcessingTime = r.getProcessingTimeMs();
                }
            }

            Map<String, Object> relatedData = new HashMap<>();
            relatedData.put("thresholdMs", timeoutThreshold);
            relatedData.put("slowCallbackCount", slowCallbacks.size());
            relatedData.put("maxProcessingTime", maxProcessingTime);

            IssueDetail issue = IssueDetail.builder()
                    .issueType(IssueType.CALLBACK_TIMEOUT)
                    .severity(IssueSeverity.MEDIUM)
                    .title("回调处理超时")
                    .description(String.format("发现 %d 个回调处理时间超过 %dms", 
                            slowCallbacks.size(), timeoutThreshold))
                    .occurredAt(LocalDateTime.now())
                    .relatedData(relatedData)
                    .suggestedAction("检查回调处理逻辑性能，考虑异步处理或优化数据库操作。")
                    .build();
            report.getIssues().add(issue);
        }
    }

    private void detectAmountMismatch(IssueReport report, Order order, 
                                       List<PaymentTransaction> transactions) {
        BigDecimal orderAmount = order.getAmount();
        
        for (PaymentTransaction tx : transactions) {
            if (tx.getStatus() == PaymentStatus.SUCCESS && 
                tx.getAmount().compareTo(orderAmount) != 0) {

                Map<String, Object> relatedData = new HashMap<>();
                relatedData.put("orderAmount", orderAmount.toString());
                relatedData.put("paymentAmount", tx.getAmount().toString());
                relatedData.put("transactionId", tx.getTransactionId());

                IssueDetail issue = IssueDetail.builder()
                        .issueType(IssueType.DUPLICATE_PAYMENT)
                        .severity(IssueSeverity.CRITICAL)
                        .title("支付金额不一致")
                        .description(String.format("订单金额 %s 与支付金额 %s 不一致",
                                orderAmount, tx.getAmount()))
                        .occurredAt(tx.getCreatedAt())
                        .affectedEntity("Transaction: " + tx.getTransactionId())
                        .relatedData(relatedData)
                        .suggestedAction("立即核实支付金额，可能存在串单或金额篡改风险。")
                        .build();
                report.getIssues().add(issue);
            }
        }
    }

    public IssueReport getReport(String reportId) {
        return issueReports.get(reportId);
    }

    public List<IssueReport> getAllReports() {
        return new ArrayList<>(issueReports.values());
    }

    public enum IssueSeverity {
        CRITICAL,
        HIGH,
        MEDIUM,
        LOW,
        INFO
    }

    @Data
    @Builder
    public static class IssueReport {
        private String reportId;
        private String orderId;
        private LocalDateTime generatedAt;
        private List<IssueDetail> issues;
        private Order orderDetails;
        private int transactionCount;
        private int callbackCount;

        public boolean hasIssues() {
            return issues != null && !issues.isEmpty();
        }

        public int getCriticalIssues() {
            return (int) issues.stream()
                    .filter(i -> i.getSeverity() == IssueSeverity.CRITICAL)
                    .count();
        }

        public int getHighIssues() {
            return (int) issues.stream()
                    .filter(i -> i.getSeverity() == IssueSeverity.HIGH)
                    .count();
        }

        @Data
        @Builder
        public static class IssueDetail {
            private IssueType issueType;
            private IssueSeverity severity;
            private String title;
            private String description;
            private LocalDateTime occurredAt;
            private String affectedEntity;
            private Map<String, Object> relatedData;
            private String suggestedAction;
        }
    }
}
