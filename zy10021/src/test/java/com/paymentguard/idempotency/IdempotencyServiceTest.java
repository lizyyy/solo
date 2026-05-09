package com.paymentguard.idempotency;

import com.paymentguard.idempotency.service.IdempotencyRecord;
import com.paymentguard.idempotency.service.IdempotencyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class IdempotencyServiceTest {

    @Autowired
    private IdempotencyService idempotencyService;

    private String testKey;

    @BeforeEach
    void setUp() {
        testKey = "test:idempotency:" + System.currentTimeMillis();
    }

    @Test
    @DisplayName("首次请求 - 成功标记为处理中")
    void checkAndSetProcessing_FirstRequest_ShouldSucceed() {
        boolean result = idempotencyService.checkAndSetProcessing(testKey);
        assertTrue(result);
    }

    @Test
    @DisplayName("重复请求 - 应被拦截")
    void checkAndSetProcessing_DuplicateRequest_ShouldFail() {
        idempotencyService.checkAndSetProcessing(testKey);
        
        boolean result = idempotencyService.checkAndSetProcessing(testKey);
        assertFalse(result);
    }

    @Test
    @DisplayName("标记处理成功")
    void markSuccess_ShouldUpdateRecord() {
        idempotencyService.checkAndSetProcessing(testKey);
        idempotencyService.markSuccess(testKey, "result data");
        
        IdempotencyRecord record = idempotencyService.getRecord(testKey);
        assertNotNull(record);
        assertEquals("SUCCESS", record.getStatus());
        assertNotNull(record.getResult());
    }

    @Test
    @DisplayName("标记处理失败")
    void markFailed_ShouldUpdateRecord() {
        idempotencyService.checkAndSetProcessing(testKey);
        idempotencyService.markFailed(testKey, "test error");
        
        IdempotencyRecord record = idempotencyService.getRecord(testKey);
        assertNotNull(record);
        assertEquals("FAILED", record.getStatus());
        assertEquals("test error", record.getErrorMessage());
    }

    @Test
    @DisplayName("检查是否已处理")
    void isProcessed_ShouldReturnCorrectStatus() {
        assertFalse(idempotencyService.isProcessed(testKey));
        
        idempotencyService.checkAndSetProcessing(testKey);
        idempotencyService.markSuccess(testKey, "data");
        
        assertTrue(idempotencyService.isProcessed(testKey));
    }

    @Test
    @DisplayName("带幂等性执行回调")
    void executeIdempotent_ShouldExecuteCallback() {
        String result = idempotencyService.executeIdempotent(testKey, () -> {
            return "result";
        });
        
        assertEquals("result", result);
        assertTrue(idempotencyService.isProcessed(testKey));
    }
}
