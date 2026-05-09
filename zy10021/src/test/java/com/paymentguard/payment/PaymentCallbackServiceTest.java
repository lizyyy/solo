package com.paymentguard.payment;

import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.common.enums.CallbackStatus;
import com.paymentguard.common.enums.PaymentStatus;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import com.paymentguard.payment.entity.CallbackRecord;
import com.paymentguard.payment.service.PaymentCallbackService;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PaymentCallbackServiceTest {

    @Autowired
    private PaymentCallbackService callbackService;

    @Autowired
    private OrderService orderService;

    private Order testOrder;
    private PaymentCallbackRequest callbackRequest;

    @BeforeEach
    void setUp() {
        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setProductName("测试商品");
        orderRequest.setAmount(new BigDecimal("299.00"));
        orderRequest.setMerchantId("TEST_MERCHANT");
        
        testOrder = orderService.createOrder(orderRequest);
        
        callbackRequest = new PaymentCallbackRequest();
        callbackRequest.setTransactionId("TXN_TEST_" + System.currentTimeMillis());
        callbackRequest.setOrderId(testOrder.getOrderId());
        callbackRequest.setAmount(new BigDecimal("299.00"));
        callbackRequest.setCurrency("CNY");
        callbackRequest.setStatus(PaymentStatus.SUCCESS);
        callbackRequest.setPaymentMethod("ALIPAY");
        callbackRequest.setChannelOrderId("CHANNEL_TEST_001");
        callbackRequest.setMerchantId("TEST_MERCHANT");
        callbackRequest.setSuccessTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }

    @Test
    @DisplayName("支付回调 - 首次成功回调")
    void processCallback_FirstSuccess_ShouldSucceed() {
        CallbackRecord record = callbackService.processCallback(callbackRequest);
        
        assertNotNull(record);
        assertEquals(CallbackStatus.SUCCESS, record.getStatus());
        assertFalse(record.getIsDuplicate());
    }

    @Test
    @DisplayName("支付回调 - 重复回调应被识别")
    void processCallback_DuplicateCallback_ShouldBeDetected() {
        callbackService.processCallback(callbackRequest);
        
        CallbackRecord duplicateRecord = callbackService.processCallback(callbackRequest);
        
        assertTrue(duplicateRecord.getIsDuplicate());
    }

    @Test
    @DisplayName("支付回调 - 支付失败场景")
    void processCallback_FailedPayment_ShouldUpdateStatus() {
        callbackRequest.setStatus(PaymentStatus.FAILED);
        
        CallbackRecord record = callbackService.processCallback(callbackRequest);
        
        assertEquals(CallbackStatus.SUCCESS, record.getStatus());
    }

    @Test
    @DisplayName("查询回调记录 - 按订单号")
    void getCallbacksByOrder_ShouldReturnRecords() {
        callbackService.processCallback(callbackRequest);
        
        List<CallbackRecord> records = callbackService.getCallbacksByOrder(testOrder.getOrderId());
        
        assertFalse(records.isEmpty());
        assertTrue(records.stream().anyMatch(r -> r.getOrderId().equals(testOrder.getOrderId())));
    }

    @Test
    @DisplayName("查询回调记录 - 按交易号")
    void getCallbacksByTransaction_ShouldReturnRecords() {
        callbackService.processCallback(callbackRequest);
        
        List<CallbackRecord> records = callbackService.getCallbacksByTransaction(
                callbackRequest.getTransactionId());
        
        assertFalse(records.isEmpty());
    }

    @Test
    @DisplayName("查询交易记录 - 按订单号")
    void getTransactionsByOrder_ShouldReturnTransactions() {
        callbackService.processCallback(callbackRequest);
        
        var transactions = callbackService.getTransactionsByOrder(testOrder.getOrderId());
        
        assertFalse(transactions.isEmpty());
        assertEquals(1, transactions.size());
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        public MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }
}
