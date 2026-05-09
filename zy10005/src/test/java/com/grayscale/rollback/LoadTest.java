package com.grayscale.rollback;

import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.service.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
@Slf4j
@Disabled("压测样例，需要手动运行")
class LoadTest {
    
    @Autowired
    private ReleaseService releaseService;
    
    @Autowired
    private OperationLogService logService;
    
    @Autowired
    private ErrorReplayService replayService;
    
    @MockBean
    private RedisTemplate<String, Object> redisTemplate;
    
    @Test
    void testConcurrentCreateRelease() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));
        doNothing().when(redisTemplate).delete(anyString());
        
        int threadCount = 50;
        int operationsPerThread = 20;
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<Future<Long>> futures = new ArrayList<>();
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        
        long startTime = System.currentTimeMillis();
        
        for (int i = 0; i < threadCount; i++) {
            final int threadIndex = i;
            futures.add(executor.submit(() -> {
                long threadStart = System.currentTimeMillis();
                for (int j = 0; j < operationsPerThread; j++) {
                    try {
                        Release release = releaseService.createRelease(
                            "service-" + (threadIndex % 10),
                            "v1.0." + j,
                            "v2.0." + j,
                            10,
                            "{\"thread\":" + threadIndex + "}"
                        );
                        successCount.incrementAndGet();
                    } catch (Exception e) {
                        failCount.incrementAndGet();
                        log.error("Create failed: {}", e.getMessage());
                    }
                }
                latch.countDown();
                return System.currentTimeMillis() - threadStart;
            }));
        }
        
        latch.await(60, TimeUnit.SECONDS);
        executor.shutdown();
        
        long totalTime = System.currentTimeMillis() - startTime;
        long totalOperations = (long) threadCount * operationsPerThread;
        
        log.info("=== 并发创建发布压测结果 ===");
        log.info("总操作数: {}", totalOperations);
        log.info("成功: {}", successCount.get());
        log.info("失败: {}", failCount.get());
        log.info("总耗时: {}ms", totalTime);
        log.info("吞吐量: {} ops/s", (totalOperations * 1000.0 / totalTime));
        log.info("平均耗时: {}ms", (totalTime * 1.0 / totalOperations));
        
        double avgLatency = 0;
        for (Future<Long> future : futures) {
            try {
                avgLatency += future.get();
            } catch (Exception e) {
                log.error("Future error", e);
            }
        }
        log.info("线程平均耗时: {}ms", (avgLatency / threadCount / operationsPerThread));
    }
    
    @Test
    void testConcurrentCanaryAdvance() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));
        doNothing().when(redisTemplate).delete(anyString());
        
        int releaseCount = 10;
        int concurrentThreads = 20;
        
        List<String> releaseIds = new ArrayList<>();
        for (int i = 0; i < releaseCount; i++) {
            Release release = releaseService.createRelease(
                "stress-test-service-" + i,
                "v1.0.0",
                "v2.0.0",
                100,
                "{\"stress_test\":true}"
            );
            releaseService.startRelease(release.getId());
            releaseIds.add(release.getId());
        }
        
        ExecutorService executor = Executors.newFixedThreadPool(concurrentThreads);
        CountDownLatch latch = new CountDownLatch(concurrentThreads);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        AtomicLong totalLatency = new AtomicLong(0);
        
        long startTime = System.currentTimeMillis();
        
        for (int i = 0; i < concurrentThreads; i++) {
            final int threadIndex = i;
            executor.submit(() -> {
                for (int j = 0; j < 5; j++) {
                    String releaseId = releaseIds.get(threadIndex % releaseCount);
                    long opStart = System.currentTimeMillis();
                    try {
                        releaseService.advanceCanary(releaseId);
                        successCount.incrementAndGet();
                    } catch (Exception e) {
                        failCount.incrementAndGet();
                    } finally {
                        totalLatency.addAndGet(System.currentTimeMillis() - opStart);
                    }
                }
                latch.countDown();
            });
        }
        
        latch.await(120, TimeUnit.SECONDS);
        executor.shutdown();
        
        long totalTime = System.currentTimeMillis() - startTime;
        int totalOps = concurrentThreads * 5;
        
        log.info("=== 并发灰度推进压测结果 ===");
        log.info("总操作数: {}", totalOps);
        log.info("成功: {}", successCount.get());
        log.info("失败: {}", failCount.get());
        log.info("总耗时: {}ms", totalTime);
        log.info("吞吐量: {} ops/s", (totalOps * 1000.0 / totalTime));
        log.info("平均延迟: {}ms", (totalLatency.get() * 1.0 / totalOps));
        
        for (String releaseId : releaseIds) {
            var logs = logService.getLogsForRelease(releaseId);
            log.info("Release {} 操作日志数: {}", releaseId, logs.size());
        }
    }
    
    @Test
    void testMixedWorkload() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));
        doNothing().when(redisTemplate).delete(anyString());
        
        int releaseCount = 5;
        int threadPairs = 10;
        
        List<String> releaseIds = new ArrayList<>();
        for (int i = 0; i < releaseCount; i++) {
            Release release = releaseService.createRelease(
                "mixed-workload-service-" + i,
                "v1.0.0",
                "v2.0.0",
                50,
                null
            );
            releaseService.startRelease(release.getId());
            releaseIds.add(release.getId());
        }
        
        ExecutorService executor = Executors.newFixedThreadPool(threadPairs * 2);
        CountDownLatch latch = new CountDownLatch(threadPairs * 2);
        AtomicInteger advanceSuccess = new AtomicInteger(0);
        AtomicInteger rollbackSuccess = new AtomicInteger(0);
        AtomicInteger totalFailures = new AtomicInteger(0);
        
        long startTime = System.currentTimeMillis();
        
        for (int i = 0; i < threadPairs; i++) {
            final int idx = i;
            
            executor.submit(() -> {
                for (int j = 0; j < 3; j++) {
                    try {
                        String releaseId = releaseIds.get(idx % releaseCount);
                        releaseService.advanceCanary(releaseId);
                        advanceSuccess.incrementAndGet();
                    } catch (Exception e) {
                        totalFailures.incrementAndGet();
                    }
                }
                latch.countDown();
            });
            
            executor.submit(() -> {
                for (int j = 0; j < 2; j++) {
                    try {
                        String releaseId = releaseIds.get((idx + 1) % releaseCount);
                        releaseService.triggerRollback(releaseId, "Stress test rollback");
                        releaseService.executeRollback(releaseId);
                        rollbackSuccess.incrementAndGet();
                    } catch (Exception e) {
                        totalFailures.incrementAndGet();
                    }
                }
                latch.countDown();
            });
        }
        
        latch.await(180, TimeUnit.SECONDS);
        executor.shutdown();
        
        long totalTime = System.currentTimeMillis() - startTime;
        
        log.info("=== 混合工作负载压测结果 ===");
        log.info("推进成功: {}", advanceSuccess.get());
        log.info("回滚成功: {}", rollbackSuccess.get());
        log.info("总失败: {}", totalFailures.get());
        log.info("总耗时: {}ms", totalTime);
        
        for (String releaseId : releaseIds) {
            var release = releaseService.getRelease(releaseId);
            release.ifPresent(r -> 
                log.info("Release {}: Status={}, UpdatedInstances={}", 
                    r.getId(), r.getStatus(), r.getUpdatedInstances())
            );
        }
    }
}
