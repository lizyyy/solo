package com.paymentguard.order;

import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.common.enums.OrderStatus;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.repository.OrderRepository;
import com.paymentguard.order.service.OrderService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OrderServiceTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderRepository orderRepository;

    private CreateOrderRequest createRequest;

    @BeforeEach
    void setUp() {
        createRequest = new CreateOrderRequest();
        createRequest.setProductName("测试商品");
        createRequest.setAmount(new BigDecimal("100.00"));
        createRequest.setCurrency("CNY");
        createRequest.setMerchantId("TEST_MERCHANT_001");
    }

    @Test
    @DisplayName("创建订单 - 成功创建待支付订单")
    void createOrder_ShouldCreatePendingOrder() {
        Order order = orderService.createOrder(createRequest);
        
        assertNotNull(order);
        assertNotNull(order.getOrderId());
        assertTrue(order.getOrderId().startsWith("ORD"));
        assertEquals(OrderStatus.PENDING, order.getStatus());
        assertEquals(new BigDecimal("100.00"), order.getAmount());
        assertEquals("CNY", order.getCurrency());
        assertEquals("TEST_MERCHANT_001", order.getMerchantId());
        assertEquals(new BigDecimal("0"), order.getPaidAmount());
        assertEquals(0, order.getPaymentCount());
    }

    @Test
    @DisplayName("查询订单 - 按订单号查询")
    void getOrder_ShouldReturnOrder() {
        Order created = orderService.createOrder(createRequest);
        Order found = orderService.getOrder(created.getOrderId());
        
        assertNotNull(found);
        assertEquals(created.getOrderId(), found.getOrderId());
    }

    @Test
    @DisplayName("订单状态流转 - 待支付 -> 已支付")
    void updateOrderStatus_PendingToPaid() {
        Order order = orderService.createOrder(createRequest);
        
        Order updated = orderService.updateOrderStatus(order.getOrderId(), OrderStatus.PAID);
        
        assertEquals(OrderStatus.PAID, updated.getStatus());
    }

    @Test
    @DisplayName("订单状态流转 - 非法状态转移应抛出异常")
    void updateOrderStatus_InvalidTransition_ShouldThrow() {
        Order order = orderService.createOrder(createRequest);
        orderService.updateOrderStatus(order.getOrderId(), OrderStatus.CANCELLED);
        
        assertThrows(Exception.class, () -> {
            orderService.updateOrderStatus(order.getOrderId(), OrderStatus.PAID);
        });
    }

    @Test
    @DisplayName("标记订单已支付")
    void markOrderPaid_ShouldUpdateOrder() {
        Order order = orderService.createOrder(createRequest);
        
        Order updated = orderService.markOrderPaid(order.getOrderId(), new BigDecimal("100.00"));
        
        assertEquals(OrderStatus.PAID, updated.getStatus());
        assertEquals(new BigDecimal("100.00"), updated.getPaidAmount());
        assertEquals(1, updated.getPaymentCount());
    }

    @Test
    @DisplayName("订单存在检查")
    void orderExists_ShouldReturnCorrectValue() {
        Order order = orderService.createOrder(createRequest);
        
        assertTrue(orderService.orderExists(order.getOrderId()));
        assertFalse(orderService.orderExists("ORD_NON_EXISTENT_001"));
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        public MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }
}
