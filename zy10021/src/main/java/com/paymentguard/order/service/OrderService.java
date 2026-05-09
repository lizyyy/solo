package com.paymentguard.order.service;

import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.common.enums.IssueType;
import com.paymentguard.common.enums.OrderStatus;
import com.paymentguard.common.exception.PaymentGuardException;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.repository.OrderRepository;
import com.paymentguard.tracing.util.TraceContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final MeterRegistry meterRegistry;

    private Counter orderCreatedCounter;
    private Counter orderStatusChangeCounter;

    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        Order order = Order.builder()
                .productName(request.getProductName())
                .amount(request.getAmount())
                .currency(request.getCurrency() != null ? request.getCurrency() : "CNY")
                .status(OrderStatus.PENDING)
                .merchantId(request.getMerchantId())
                .notifyUrl(request.getNotifyUrl())
                .extra(request.getExtra())
                .paidAmount(BigDecimal.ZERO)
                .paymentCount(0)
                .build();

        Order savedOrder = orderRepository.save(order);
        log.info("Order created: orderId={}, amount={}, traceId={}", 
                savedOrder.getOrderId(), savedOrder.getAmount(), TraceContext.getTraceId());
        
        getOrderCreatedCounter().increment();
        return savedOrder;
    }

    @Transactional(readOnly = true)
    public Order getOrder(String orderId) {
        return orderRepository.findByOrderId(orderId)
                .orElseThrow(() -> new PaymentGuardException(
                        IssueType.DATA_INTEGRITY_ISSUE,
                        "订单不存在: " + orderId));
    }

    @Transactional(readOnly = true)
    public Order getOrderForUpdate(String orderId) {
        return orderRepository.findByOrderIdForUpdate(orderId)
                .orElseThrow(() -> new PaymentGuardException(
                        IssueType.DATA_INTEGRITY_ISSUE,
                        "订单不存在: " + orderId));
    }

    @Transactional
    public Order updateOrderStatus(String orderId, OrderStatus newStatus) {
        Order order = getOrderForUpdate(orderId);
        
        OrderStatus currentStatus = order.getStatus();
        if (!currentStatus.canTransitionTo(newStatus)) {
            throw new PaymentGuardException(
                    IssueType.ORDER_STATUS_INCONSISTENCY,
                    String.format("订单状态不允许从 %s 转移到 %s", 
                            currentStatus.getDescription(), newStatus.getDescription()));
        }
        
        order.setStatus(newStatus);
        Order savedOrder = orderRepository.save(order);
        
        log.info("Order status updated: orderId={}, from={}, to={}, traceId={}",
                orderId, currentStatus, newStatus, TraceContext.getTraceId());
        
        getOrderStatusChangeCounter().increment();
        return savedOrder;
    }

    @Transactional
    public Order markOrderPaid(String orderId, BigDecimal paidAmount) {
        Order order = getOrderForUpdate(orderId);
        
        if (!order.canPay()) {
            throw new PaymentGuardException(
                    IssueType.ORDER_STATUS_INCONSISTENCY,
                    String.format("订单当前状态不允许支付: orderId=%s, status=%s", 
                            orderId, order.getStatus().getDescription()));
        }
        
        order.markPaid(paidAmount);
        Order savedOrder = orderRepository.save(order);
        
        log.info("Order marked as paid: orderId={}, paidAmount={}, paymentCount={}, traceId={}",
                orderId, paidAmount, order.getPaymentCount(), TraceContext.getTraceId());
        
        return savedOrder;
    }

    @Transactional
    public Order incrementPaymentCount(String orderId) {
        Order order = getOrderForUpdate(orderId);
        order.incrementPaymentCount();
        return orderRepository.save(order);
    }

    @Transactional(readOnly = true)
    public boolean orderExists(String orderId) {
        return orderRepository.existsByOrderId(orderId);
    }

    private Counter getOrderCreatedCounter() {
        if (orderCreatedCounter == null) {
            orderCreatedCounter = Counter.builder("orders_created_total")
                    .description("Total number of orders created")
                    .register(meterRegistry);
        }
        return orderCreatedCounter;
    }

    private Counter getOrderStatusChangeCounter() {
        if (orderStatusChangeCounter == null) {
            orderStatusChangeCounter = Counter.builder("orders_status_changed_total")
                    .description("Total number of order status changes")
                    .register(meterRegistry);
        }
        return orderStatusChangeCounter;
    }
}
