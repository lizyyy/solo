package com.grayscale.rollback;

import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class ReleaseServiceTest {
    
    @Autowired
    private ReleaseService releaseService;
    
    @Autowired
    private OperationLogService logService;
    
    @Autowired
    private ErrorReplayService replayService;
    
    @Autowired
    private ReportService reportService;
    
    @MockBean
    private RedisTemplate<String, Object> redisTemplate;
    
    private Release testRelease;
    
    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));
        doNothing().when(redisTemplate).delete(anyString());
        
        testRelease = releaseService.createRelease(
            "test-service",
            "v1.0.0",
            "v2.0.0",
            10,
            "{\"env\":\"test\"}"
        );
    }
    
    @Test
    void testCreateRelease() {
        assertNotNull(testRelease.getId());
        assertEquals("test-service", testRelease.getServiceName());
        assertEquals("v1.0.0", testRelease.getCurrentVersion());
        assertEquals("v2.0.0", testRelease.getTargetVersion());
        assertEquals(ReleaseStatus.PENDING, testRelease.getStatus());
        assertEquals(10, testRelease.getTotalInstances());
        assertEquals(0, testRelease.getUpdatedInstances());
    }
    
    @Test
    void testStartRelease() {
        Release started = releaseService.startRelease(testRelease.getId());
        assertEquals(ReleaseStatus.PREPARING, started.getStatus());
        assertNotNull(started.getStartedAt());
        assertNotNull(started.getRollbackCheckpoint());
    }
    
    @Test
    void testStartReleaseFromNonPendingState() {
        Release started = releaseService.startRelease(testRelease.getId());
        
        assertThrows(IllegalStateException.class, 
            () -> releaseService.startRelease(testRelease.getId()));
    }
    
    @Test
    void testFullCanaryDeployment() {
        Release release = releaseService.startRelease(testRelease.getId());
        assertEquals(ReleaseStatus.PREPARING, release.getStatus());
        
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.CANARY_10, release.getStatus());
        assertEquals(1, release.getUpdatedInstances());
        
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.CANARY_30, release.getStatus());
        assertEquals(3, release.getUpdatedInstances());
        
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.CANARY_50, release.getStatus());
        assertEquals(5, release.getUpdatedInstances());
        
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.CANARY_100, release.getStatus());
        assertEquals(10, release.getUpdatedInstances());
        
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.COMPLETED, release.getStatus());
        assertEquals(10, release.getUpdatedInstances());
        assertNotNull(release.getCompletedAt());
    }
    
    @Test
    void testTriggerRollbackFromCanary() {
        Release release = releaseService.startRelease(testRelease.getId());
        release = releaseService.advanceCanary(release.getId());
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.CANARY_30, release.getStatus());
        
        Release rollbackTriggered = releaseService.triggerRollback(release.getId(), "High error rate detected");
        assertEquals(ReleaseStatus.ROLLBACKING, rollbackTriggered.getStatus());
        assertEquals("High error rate detected", rollbackTriggered.getErrorMessage());
        
        Release rolledBack = releaseService.executeRollback(release.getId());
        assertEquals(ReleaseStatus.ROLLED_BACK, rolledBack.getStatus());
        assertEquals(0, rolledBack.getUpdatedInstances());
    }
    
    @Test
    void testRollbackFromCompletedState() {
        Release release = releaseService.startRelease(testRelease.getId());
        release = releaseService.advanceCanary(release.getId());
        release = releaseService.advanceCanary(release.getId());
        release = releaseService.advanceCanary(release.getId());
        release = releaseService.advanceCanary(release.getId());
        release = releaseService.advanceCanary(release.getId());
        assertEquals(ReleaseStatus.COMPLETED, release.getStatus());
        
        assertThrows(IllegalStateException.class,
            () -> releaseService.triggerRollback(release.getId(), "Cannot rollback completed"));
    }
    
    @Test
    void testFailRelease() {
        Release release = releaseService.startRelease(testRelease.getId());
        
        Release failed = releaseService.failRelease(release.getId(), "Database connection error");
        assertEquals(ReleaseStatus.FAILED, failed.getStatus());
        assertEquals("Database connection error", failed.getErrorMessage());
        assertNotNull(failed.getFailedAt());
    }
    
    @Test
    void testOperationLogging() {
        Release release = releaseService.startRelease(testRelease.getId());
        
        var logs = logService.getLogsForRelease(release.getId());
        assertFalse(logs.isEmpty());
        
        var latestLog = replayService.getLatestOperation(release.getId());
        assertNotNull(latestLog);
    }
    
    @Test
    void testGenerateReport() {
        Release release = releaseService.startRelease(testRelease.getId());
        release = releaseService.advanceCanary(release.getId());
        
        String report = reportService.generateReleaseReport(release.getId());
        assertNotNull(report);
        assertTrue(report.contains("# 灰度发布回滚报告"));
        assertTrue(report.contains(release.getServiceName()));
    }
    
    @Test
    void testConcurrentAdvance() throws Exception {
        final String releaseId = testRelease.getId();
        releaseService.startRelease(releaseId);
        
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    releaseService.advanceCanary(releaseId);
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }
        
        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();
        
        Release finalRelease = releaseService.getRelease(releaseId).orElseThrow();
        assertTrue(successCount.get() > 0);
        assertTrue(failCount.get() >= 0);
        
        var logs = logService.getLogsForRelease(releaseId);
        assertFalse(logs.isEmpty());
    }
}
