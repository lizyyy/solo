package com.paymentguard.idempotency;

import com.paymentguard.idempotency.service.DistributedLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class DistributedLockServiceTest {

    @Autowired
    private DistributedLockService lockService;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private String testKey;

    @BeforeEach
    void setUp() {
        testKey = "test:lock:" + System.currentTimeMillis();
    }

    @Test
    @DisplayName("获取锁 - 成功获取")
    void tryLock_ShouldSucceed() {
        boolean acquired = lockService.tryLock(testKey, 10, TimeUnit.SECONDS);
        assertTrue(acquired);
        
        lockService.releaseLock(testKey);
    }

    @Test
    @DisplayName("获取锁 - 重复获取失败")
    void tryLock_AlreadyLocked_ShouldFail() {
        lockService.tryLock(testKey, 10, TimeUnit.SECONDS);
        
        boolean acquired = lockService.tryLock(testKey, 1, TimeUnit.SECONDS);
        assertFalse(acquired);
        
        lockService.releaseLock(testKey);
    }

    @Test
    @DisplayName("释放锁 - 成功释放")
    void releaseLock_ShouldRelease() {
        lockService.tryLock(testKey, 10, TimeUnit.SECONDS);
        lockService.releaseLock(testKey);
        
        boolean acquired = lockService.tryLock(testKey, 1, TimeUnit.SECONDS);
        assertTrue(acquired);
        
        lockService.releaseLock(testKey);
    }

    @Test
    @DisplayName("检查锁状态")
    void isLocked_ShouldReturnCorrectStatus() {
        assertFalse(lockService.isLocked(testKey));
        
        lockService.tryLock(testKey, 10, TimeUnit.SECONDS);
        assertTrue(lockService.isLocked(testKey));
        
        lockService.releaseLock(testKey);
        assertFalse(lockService.isLocked(testKey));
    }

    @Test
    @DisplayName("带锁执行回调")
    void executeWithLock_ShouldExecuteCallback() {
        String result = lockService.executeWithLock(testKey, 10, TimeUnit.SECONDS, () -> {
            return "executed";
        });
        
        assertEquals("executed", result);
        assertFalse(lockService.isLocked(testKey));
    }
}
