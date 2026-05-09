package com.paymentguard.payment.service;

import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.common.enums.*;
import com.paymentguard.common.exception.PaymentGuardException;
import com.paymentguard.common.util.JsonUtil;
import com.paymentguard.idempotency.service.DistributedLockService;
import com.paymentguard.idempotency.service.IdempotencyService;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import com.paymentguard.payment.entity.CallbackRecord;
import com.paymentguard.payment.entity.PaymentTransaction;
import com.paymentguard.payment.repository.CallbackRecordRepository;
import com.paymentguard.payment.repository.PaymentTransactionRepository;
import com.paymentguard.tracing.util.TraceContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentCallbackService {

    private final OrderService orderService;
    private final PaymentTransactionRepository transactionRepository;
    private final CallbackRecordRepository callbackRecordRepository;
    private final DistributedLockService lockService;
    private final IdempotencyService idempotencyService;
    private final MeterRegistry meterRegistry;

    @Value("${paymentguard.simulator.timeout-rate:0.05}")
    private double timeoutRate;

    @Value("${paymentguard.simulator.failure-rate:0.1}")
    private double failureRate;

    private Counter callbackReceivedCounter;
    private Counter callbackSuccessCounter;
    private Counter callbackDuplicateCounter;
    private Counter callbackFailedCounter;
    private Timer callbackProcessingTimer;

    @Transactional
    public CallbackRecord processCallback(PaymentCallbackRequest request) {
        long startTime = System.currentTimeMillis();
        String traceId = TraceContext.getTraceId();
        
        CallbackRecord record = CallbackRecord.builder()
                .orderId(request.getOrderId())
                .transactionId(request.getTransactionId())
                .status(CallbackStatus.RECEIVED)
                .requestBody(JsonUtil.toJson(request))
                .source("API")
                .traceId(traceId)
                .build();
        callbackRecordRepository.save(record);
        
        getCallbackReceivedCounter().increment();
        log.info("Payment callback received: orderId={}, transactionId={}, status={}, traceId={}",
                request.getOrderId(), request.getTransactionId(), request.getStatus(), traceId);

        try {
            String lockKey = "payment:callback:" + request.getTransactionId();
            
            if (!lockService.tryLock(lockKey, 30, TimeUnit.SECONDS)) {
                log.warn("Failed to acquire lock for transaction: {}", request.getTransactionId());
                record.setStatus(CallbackStatus.DUPLICATE);
                record.setIsDuplicate(true);
                record.setErrorMessage("无法获取分布式锁，可能存在并发处理");
                record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
                callbackRecordRepository.save(record);
                getCallbackDuplicateCounter().increment();
                return record;
            }

            try {
                long duplicateCount = callbackRecordRepository.countByTransactionId(request.getTransactionId());
                if (duplicateCount > 1) {
                    log.warn("Duplicate callback detected: transactionId={}, count={}",
                            request.getTransactionId(), duplicateCount);
                    record.setStatus(CallbackStatus.DUPLICATE);
                    record.setIsDuplicate(true);
                    record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
                    callbackRecordRepository.save(record);
                    getCallbackDuplicateCounter().increment();
                    return record;
                }

                if (!orderService.orderExists(request.getOrderId())) {
                    throw new PaymentGuardException(
                            IssueType.DATA_INTEGRITY_ISSUE,
                            "订单不存在: " + request.getOrderId());
                }

                PaymentTransaction existingTx = transactionRepository.findByTransactionId(request.getTransactionId()).orElse(null);
                
                if (existingTx != null) {
                    log.warn("Transaction already exists: transactionId={}, currentStatus={}",
                            request.getTransactionId(), existingTx.getStatus());
                    
                    if (existingTx.getStatus() == PaymentStatus.SUCCESS) {
                        record.setStatus(CallbackStatus.DUPLICATE);
                        record.setIsDuplicate(true);
                        record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
                        callbackRecordRepository.save(record);
                        getCallbackDuplicateCounter().increment();
                        return record;
                    }
                    
                    existingTx.setStatus(request.getStatus());
                    transactionRepository.save(existingTx);
                } else {
                    PaymentTransaction tx = PaymentTransaction.builder()
                            .transactionId(request.getTransactionId())
                            .orderId(request.getOrderId())
                            .amount(request.getAmount())
                            .currency(request.getCurrency() != null ? request.getCurrency() : "CNY")
                            .status(request.getStatus())
                            .paymentMethod(request.getPaymentMethod())
                            .channelOrderId(request.getChannelOrderId())
                            .bankOrderNo(request.getBankOrderNo())
                            .merchantId(request.getMerchantId())
                            .rawData(request.getRawData())
                            .traceId(traceId)
                            .build();
                    if (request.getSuccessTime() != null) {
                        tx.setSuccessTime(LocalDateTime.parse(request.getSuccessTime()));
                    }
                    transactionRepository.save(tx);
                }

                if (request.getStatus() == PaymentStatus.SUCCESS) {
                    processSuccessfulPayment(request, record);
                } else if (request.getStatus() == PaymentStatus.FAILED) {
                    processFailedPayment(request, record);
                }

                record.setStatus(CallbackStatus.SUCCESS);
                record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
                callbackRecordRepository.save(record);
                getCallbackSuccessCounter().increment();
                
                getCallbackProcessingTimer().record(System.currentTimeMillis() - startTime, TimeUnit.MILLISECONDS);
                
                return record;
            } finally {
                lockService.releaseLock(lockKey);
            }
        } catch (PaymentGuardException e) {
            log.error("Payment callback processing failed: transactionId={}, error={}", 
                    request.getTransactionId(), e.getMessage(), e);
            record.setStatus(CallbackStatus.FAILED);
            record.setErrorMessage(e.getMessage());
            record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
            callbackRecordRepository.save(record);
            getCallbackFailedCounter().increment();
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during callback processing: transactionId={}", 
                    request.getTransactionId(), e);
            record.setStatus(CallbackStatus.FAILED);
            record.setErrorMessage(e.getMessage());
            record.setProcessingTimeMs(System.currentTimeMillis() - startTime);
            callbackRecordRepository.save(record);
            getCallbackFailedCounter().increment();
            throw new PaymentGuardException(IssueType.DATA_INTEGRITY_ISSUE, 
                    "回调处理发生异常: " + e.getMessage(), e);
        }
    }

    private void processSuccessfulPayment(PaymentCallbackRequest request, CallbackRecord record) {
        Order order = orderService.getOrder(request.getOrderId());
        
        if (order.getStatus() == OrderStatus.PAID) {
            log.warn("Order already paid but received success callback: orderId={}, paymentCount={}",
                    order.getOrderId(), order.getPaymentCount());
            orderService.incrementPaymentCount(order.getOrderId());
            record.setIsDuplicate(true);
            getCallbackDuplicateCounter().increment();
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new PaymentGuardException(
                    IssueType.ORDER_STATUS_INCONSISTENCY,
                    String.format("订单状态不允许支付: orderId=%s, currentStatus=%s",
                            order.getOrderId(), order.getStatus().getDescription()));
        }

        BigDecimal expectedAmount = order.getAmount();
        if (request.getAmount().compareTo(expectedAmount) != 0) {
            throw new PaymentGuardException(
                    IssueType.DUPLICATE_PAYMENT,
                    String.format("支付金额不一致: expected=%s, actual=%s, orderId=%s",
                            expectedAmount, request.getAmount(), order.getOrderId()));
        }

        orderService.markOrderPaid(order.getOrderId(), request.getAmount());
        
        log.info("Payment processed successfully: orderId={}, transactionId={}, amount={}",
                order.getOrderId(), request.getTransactionId(), request.getAmount());
    }

    private void processFailedPayment(PaymentCallbackRequest request, CallbackRecord record) {
        Order order = orderService.getOrder(request.getOrderId());
        
        if (order.getStatus() == OrderStatus.PENDING) {
            orderService.updateOrderStatus(order.getOrderId(), OrderStatus.FAILED);
        }
        
        log.info("Payment failed: orderId={}, transactionId={}", request.getOrderId(), request.getTransactionId());
    }

    @Transactional(readOnly = true)
    public List<CallbackRecord> getCallbacksByOrder(String orderId) {
        return callbackRecordRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    }

    @Transactional(readOnly = true)
    public List<CallbackRecord> getCallbacksByTransaction(String transactionId) {
        return callbackRecordRepository.findByTransactionIdOrderByCreatedAtDesc(transactionId);
    }

    @Transactional(readOnly = true)
    public List<PaymentTransaction> getTransactionsByOrder(String orderId) {
        return transactionRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    }

    private Counter getCallbackReceivedCounter() {
        if (callbackReceivedCounter == null) {
            callbackReceivedCounter = Counter.builder("payment_callback_received_total")
                    .description("Total payment callbacks received")
                    .register(meterRegistry);
        }
        return callbackReceivedCounter;
    }

    private Counter getCallbackSuccessCounter() {
        if (callbackSuccessCounter == null) {
            callbackSuccessCounter = Counter.builder("payment_callback_success_total")
                    .description("Total successful payment callbacks")
                    .register(meterRegistry);
        }
        return callbackSuccessCounter;
    }

    private Counter getCallbackDuplicateCounter() {
        if (callbackDuplicateCounter == null) {
            callbackDuplicateCounter = Counter.builder("payment_callback_duplicate_total")
                    .description("Total duplicate payment callbacks")
                    .register(meterRegistry);
        }
        return callbackDuplicateCounter;
    }

    private Counter getCallbackFailedCounter() {
        if (callbackFailedCounter == null) {
            callbackFailedCounter = Counter.builder("payment_callback_failed_total")
                    .description("Total failed payment callbacks")
                    .register(meterRegistry);
        }
        return callbackFailedCounter;
    }

    private Timer getCallbackProcessingTimer() {
        if (callbackProcessingTimer == null) {
            callbackProcessingTimer = Timer.builder("payment_callback_processing_duration")
                    .description("Payment callback processing duration")
                    .register(meterRegistry);
        }
        return callbackProcessingTimer;
    }
}
