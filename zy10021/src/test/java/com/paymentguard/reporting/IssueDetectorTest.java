package com.paymentguard.reporting;

import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.common.enums.PaymentStatus;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import com.paymentguard.payment.service.PaymentCallbackService;
import com.paymentguard.reporting.detector.IssueDetector;
import com.paymentguard.reporting.detector.IssueDetector.IssueReport;
import com.paymentguard.reporting.exporter.ReportExporter;
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
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class IssueDetectorTest {

    @Autowired
    private IssueDetector issueDetector;

    @Autowired
    private ReportExporter reportExporter;

    @Autowired
    private OrderService orderService;

    @Autowired
    private PaymentCallbackService callbackService;

    private Order testOrder;

    @BeforeEach
    void setUp() {
        CreateOrderRequest orderRequest = new CreateOrderRequest();
        orderRequest.setProductName("测试商品");
        orderRequest.setAmount(new BigDecimal("599.00"));
        orderRequest.setMerchantId("TEST_MERCHANT");
        
        testOrder = orderService.createOrder(orderRequest);
    }

    @Test
    @DisplayName("问题检测 - 正常订单应无问题")
    void detectIssues_NormalOrder_ShouldHaveNoIssues() {
        PaymentCallbackRequest callbackRequest = new PaymentCallbackRequest();
        callbackRequest.setTransactionId("TXN_NORMAL_" + System.currentTimeMillis());
        callbackRequest.setOrderId(testOrder.getOrderId());
        callbackRequest.setAmount(new BigDecimal("599.00"));
        callbackRequest.setStatus(PaymentStatus.SUCCESS);
        callbackRequest.setSuccessTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        callbackService.processCallback(callbackRequest);
        
        IssueReport report = issueDetector.detectIssues(testOrder.getOrderId());
        
        assertNotNull(report);
        assertEquals(testOrder.getOrderId(), report.getOrderId());
    }

    @Test
    @DisplayName("问题检测 - 重复回调检测")
    void detectIssues_DuplicateCallbacks_ShouldBeDetected() {
        String transactionId = "TXN_DUPLICATE_" + System.currentTimeMillis();
        
        PaymentCallbackRequest callbackRequest = new PaymentCallbackRequest();
        callbackRequest.setTransactionId(transactionId);
        callbackRequest.setOrderId(testOrder.getOrderId());
        callbackRequest.setAmount(new BigDecimal("599.00"));
        callbackRequest.setStatus(PaymentStatus.SUCCESS);
        callbackRequest.setSuccessTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        callbackService.processCallback(callbackRequest);
        callbackService.processCallback(callbackRequest);
        
        IssueReport report = issueDetector.detectIssues(testOrder.getOrderId());
        
        assertNotNull(report);
        assertEquals(testOrder.getOrderId(), report.getOrderId());
    }

    @Test
    @DisplayName("报告导出 - JSON格式")
    void exportToJson_ShouldGenerateValidJson() {
        IssueReport report = issueDetector.detectIssues(testOrder.getOrderId());
        assertNotNull(report);
        
        byte[] jsonBytes = reportExporter.exportToJson(report.getReportId());
        
        assertNotNull(jsonBytes);
        assertTrue(jsonBytes.length > 0);
        
        String jsonStr = new String(jsonBytes, StandardCharsets.UTF_8);
        assertTrue(jsonStr.contains("reportId"));
        assertTrue(jsonStr.contains(report.getReportId()));
    }

    @Test
    @DisplayName("报告导出 - Markdown格式")
    void exportToMarkdown_ShouldGenerateValidMarkdown() {
        IssueReport report = issueDetector.detectIssues(testOrder.getOrderId());
        assertNotNull(report);
        
        byte[] mdBytes = reportExporter.exportToMarkdown(report.getReportId());
        
        assertNotNull(mdBytes);
        assertTrue(mdBytes.length > 0);
        
        String mdStr = new String(mdBytes, StandardCharsets.UTF_8);
        assertTrue(mdStr.contains("#"));
        assertTrue(mdStr.contains(report.getReportId()));
    }

    @Test
    @DisplayName("报告导出 - HTML格式")
    void exportToHtml_ShouldGenerateValidHtml() {
        IssueReport report = issueDetector.detectIssues(testOrder.getOrderId());
        assertNotNull(report);
        
        byte[] htmlBytes = reportExporter.exportToHtml(report.getReportId());
        
        assertNotNull(htmlBytes);
        assertTrue(htmlBytes.length > 0);
        
        String htmlStr = new String(htmlBytes, StandardCharsets.UTF_8);
        assertTrue(htmlStr.contains("<!DOCTYPE html>"));
        assertTrue(htmlStr.contains("<html"));
    }

    @TestConfiguration
    static class TestConfig {
        @Bean
        public MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }
}
