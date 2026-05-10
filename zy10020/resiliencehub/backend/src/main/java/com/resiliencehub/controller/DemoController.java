package com.resiliencehub.controller;

import com.resiliencehub.circuitbreaker.CircuitBreakerService;
import com.resiliencehub.common.Result;
import com.resiliencehub.fault.FaultInjector;
import com.resiliencehub.ratelimit.RateLimit;
import com.resiliencehub.ratelimit.RateLimitService;
import com.resiliencehub.tracing.TraceContext;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@RestController
@RequestMapping("/api/v1/demo")
public class DemoController {
    
    private final RateLimitService rateLimitService;
    private final CircuitBreakerService circuitBreakerService;
    private final FaultInjector faultInjector;
    private final ThreadPoolTaskExecutor simulationExecutor;
    
    public DemoController(RateLimitService rateLimitService,
                         CircuitBreakerService circuitBreakerService,
                         FaultInjector faultInjector,
                         @Qualifier("simulationExecutor") ThreadPoolTaskExecutor simulationExecutor) {
        this.rateLimitService = rateLimitService;
        this.circuitBreakerService = circuitBreakerService;
        this.faultInjector = faultInjector;
        this.simulationExecutor = simulationExecutor;
    }
    
    @GetMapping("/rate-limit")
    @RateLimit(key = "demo:api", limit = 10, window = 1)
    public Result<?> rateLimitDemo(@RequestParam(defaultValue = "demo") String clientId) {
        String key = "demo:" + clientId;
        boolean allowed = rateLimitService.tryAcquireTokenBucket(key, 10, 1);
        
        Map<String, Object> result = new HashMap<>();
        result.put("allowed", allowed);
        result.put("clientId", clientId);
        result.put("traceId", TraceContext.getTraceId());
        result.put("metrics", rateLimitService.getMetrics(key));
        
        if (!allowed) {
            return Result.rateLimited();
        }
        
        return Result.success(result);
    }
    
    @PostMapping("/circuit-breaker/test")
    public Result<?> circuitBreakerDemo(@RequestParam boolean shouldFail) {
        String cbName = "demoService";
        CircuitBreakerService.CircuitBreaker cb = circuitBreakerService.getOrCreate(
            cbName, CircuitBreakerService.CircuitBreakerConfig.defaultConfig());
        
        long startTime = System.currentTimeMillis();
        
        if (!cb.tryAcquirePermission()) {
            return Result.circuitBreakerOpen();
        }
        
        try {
            if (shouldFail) {
                throw new RuntimeException("Simulated failure");
            }
            cb.onSuccess(System.currentTimeMillis() - startTime);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("circuitState", cb.getState());
            result.put("metrics", cb.getMetrics());
            result.put("traceId", TraceContext.getTraceId());
            
            return Result.success(result);
        } catch (Exception e) {
            cb.onFailure(System.currentTimeMillis() - startTime, e);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("circuitState", cb.getState());
            result.put("metrics", cb.getMetrics());
            result.put("traceId", TraceContext.getTraceId());
            
            return Result.error(result.toString());
        }
    }
    
    @GetMapping("/fault-injection")
    public Result<?> faultInjectionDemo() throws Exception {
        String endpoint = "/api/v1/demo/fault-injection";
        faultInjector.injectFault(endpoint);
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Request processed successfully");
        result.put("traceId", TraceContext.getTraceId());
        result.put("requestId", TraceContext.getRequestId());
        
        return Result.success(result);
    }
    
    @GetMapping("/retry")
    @Retry(name = "remoteService", fallbackMethod = "retryFallback")
    public Result<?> retryDemo(@RequestParam(defaultValue = "false") boolean shouldFail) {
        if (shouldFail && Math.random() < 0.5) {
            throw new RuntimeException("Simulated network error");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Request completed on first attempt");
        result.put("traceId", TraceContext.getTraceId());
        
        return Result.success(result);
    }
    
    public Result<?> retryFallback(boolean shouldFail, Exception e) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", "All retries exhausted, using fallback");
        result.put("error", e.getMessage());
        result.put("traceId", TraceContext.getTraceId());
        
        return Result.fallback(result.toString());
    }
    
    @GetMapping("/timeout")
    @TimeLimiter(name = "default", fallbackMethod = "timeoutFallback")
    public CompletableFuture<Result<?>> timeoutDemo(@RequestParam(defaultValue = "100") long delayMs) 
            throws Exception {
        return CompletableFuture.supplyAsync(() -> {
            try {
                if (delayMs > 0) {
                    Thread.sleep(delayMs);
                }
                
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("delayMs", delayMs);
                result.put("traceId", TraceContext.getTraceId());
                
                return Result.success(result);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Operation interrupted", e);
            }
        });
    }
    
    public CompletableFuture<Result<?>> timeoutFallback(long delayMs, Exception e) {
        return CompletableFuture.completedFuture(Result.fallback("Request timeout after " + delayMs + "ms"));
    }
    
    @PostMapping("/high-concurrency")
    public Result<?> highConcurrencyDemo(
            @RequestParam(defaultValue = "100") int requests,
            @RequestParam(defaultValue = "10") int concurrency) {
        
        Map<String, Object> result = new HashMap<>();
        result.put("totalRequests", requests);
        result.put("targetConcurrency", concurrency);
        result.put("traceId", TraceContext.getTraceId());
        result.put("executionType", "semaphore-controlled-concurrent");
        
        Semaphore semaphore = new Semaphore(concurrency);
        
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        AtomicInteger rateLimitedCount = new AtomicInteger(0);
        AtomicInteger actualConcurrentCount = new AtomicInteger(0);
        AtomicInteger maxObservedConcurrent = new AtomicInteger(0);
        List<Map<String, Object>> requestDetails = new ArrayList<>();
        
        String limitKey = "high-concurrency-demo:" + UUID.randomUUID().toString().substring(0, 8);
        CountDownLatch doneLatch = new CountDownLatch(requests);
        
        long startTime = System.currentTimeMillis();
        
        IntStream.range(0, requests).forEach(i -> {
            simulationExecutor.submit(() -> {
                try {
                    semaphore.acquire();
                    
                    int currentConcurrent = actualConcurrentCount.incrementAndGet();
                    maxObservedConcurrent.updateAndGet(current -> Math.max(current, currentConcurrent));
                    
                    try {
                        long requestStart = System.currentTimeMillis();
                        Map<String, Object> detail = new HashMap<>();
                        detail.put("requestIndex", i);
                        detail.put("startTime", requestStart);
                        detail.put("thread", Thread.currentThread().getName());
                        detail.put("acquiredPermit", true);
                        
                        boolean allowed = rateLimitService.tryAcquireTokenBucket(
                            limitKey, 
                            concurrency * 2, 
                            1);
                        
                        if (allowed) {
                            try {
                                Thread.sleep(10 + (long)(Math.random() * 10));
                                successCount.incrementAndGet();
                                detail.put("status", "SUCCESS");
                            } catch (InterruptedException e) {
                                failCount.incrementAndGet();
                                detail.put("status", "FAILED");
                                Thread.currentThread().interrupt();
                            }
                        } else {
                            rateLimitedCount.incrementAndGet();
                            detail.put("status", "RATE_LIMITED");
                        }
                        
                        detail.put("durationMs", System.currentTimeMillis() - requestStart);
                        synchronized(requestDetails) {
                            requestDetails.add(detail);
                        }
                    } finally {
                        actualConcurrentCount.decrementAndGet();
                        semaphore.release();
                    }
                } catch (InterruptedException e) {
                    failCount.incrementAndGet();
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        });
        
        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        long duration = System.currentTimeMillis() - startTime;
        rateLimitService.reset(limitKey);
        
        result.put("successCount", successCount.get());
        result.put("failCount", failCount.get());
        result.put("rateLimitedCount", rateLimitedCount.get());
        result.put("maxObservedConcurrent", maxObservedConcurrent.get());
        result.put("durationMs", duration);
        result.put("actualQps", requests > 0 ? (double) requests / (duration / 1000.0) : 0);
        result.put("semaphoreAvailable", semaphore.availablePermits());
        result.put("controlMethod", "Semaphore");
        
        int showDetails = Math.min(requests, 20);
        List<Map<String, Object>> sampleDetails = requestDetails.stream()
            .limit(showDetails)
            .collect(Collectors.toList());
        result.put("sampleDetails", sampleDetails);
        result.put("totalDetailsCount", requestDetails.size());
        
        return Result.success(result);
    }
    
    @GetMapping("/tracing")
    public Result<?> tracingDemo() {
        Map<String, Object> result = new HashMap<>();
        result.put("traceId", TraceContext.getTraceId());
        result.put("spanId", TraceContext.getSpanId());
        result.put("requestId", TraceContext.getRequestId());
        result.put("message", "Trace context propagated successfully");
        
        String nestedSpanId = TraceContext.startNewSpan();
        result.put("nestedSpanId", nestedSpanId);
        TraceContext.endSpan();
        
        return Result.success(result);
    }
    
    @GetMapping("/simulate-peak")
    public Result<?> simulatePeakTraffic(
            @RequestParam(defaultValue = "1000") int totalRequests,
            @RequestParam(defaultValue = "50") int concurrentUsers,
            @RequestParam(defaultValue = "100") int qpsLimit) {
        
        String limitKey = "peak-simulation:" + UUID.randomUUID().toString().substring(0, 8);
        
        int actualConcurrentUsers = Math.min(concurrentUsers, totalRequests);
        
        Map<String, Object> result = new HashMap<>();
        result.put("totalRequests", totalRequests);
        result.put("targetConcurrentUsers", actualConcurrentUsers);
        result.put("qpsLimit", qpsLimit);
        result.put("traceId", TraceContext.getTraceId());
        result.put("executionType", "semaphore-controlled-peak");
        result.put("controlMethod", "Semaphore");
        
        Semaphore semaphore = new Semaphore(actualConcurrentUsers);
        
        AtomicInteger success = new AtomicInteger(0);
        AtomicInteger rateLimited = new AtomicInteger(0);
        AtomicInteger activeThreads = new AtomicInteger(0);
        AtomicInteger maxActiveThreads = new AtomicInteger(0);
        List<Long> latencyTimes = new ArrayList<>();
        
        CountDownLatch doneLatch = new CountDownLatch(totalRequests);
        
        long startTime = System.currentTimeMillis();
        
        IntStream.range(0, totalRequests).forEach(i -> {
            simulationExecutor.submit(() -> {
                try {
                    semaphore.acquire();
                    
                    int currentActive = activeThreads.incrementAndGet();
                    maxActiveThreads.updateAndGet(cur -> Math.max(cur, currentActive));
                    
                    try {
                        long reqStart = System.currentTimeMillis();
                        boolean allowed = rateLimitService.tryAcquireSlidingWindow(limitKey, qpsLimit, 1);
                        
                        if (allowed) {
                            try {
                                Thread.sleep(5 + (long)(Math.random() * 5));
                                success.incrementAndGet();
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                        } else {
                            rateLimited.incrementAndGet();
                        }
                        
                        long latency = System.currentTimeMillis() - reqStart;
                        synchronized(latencyTimes) {
                            latencyTimes.add(latency);
                        }
                    } finally {
                        activeThreads.decrementAndGet();
                        semaphore.release();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        });
        
        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        long duration = System.currentTimeMillis() - startTime;
        rateLimitService.reset(limitKey);
        
        result.put("successCount", success.get());
        result.put("rateLimitedCount", rateLimited.get());
        result.put("durationMs", duration);
        result.put("actualQps", duration > 0 ? (double) totalRequests / (duration / 1000.0) : 0);
        result.put("maxActiveThreads", maxActiveThreads.get());
        result.put("semaphoreAvailable", semaphore.availablePermits());
        
        if (!latencyTimes.isEmpty()) {
            latencyTimes.sort(Long::compare);
            result.put("minLatencyMs", latencyTimes.get(0));
            result.put("maxLatencyMs", latencyTimes.get(latencyTimes.size() - 1));
            result.put("avgLatencyMs", latencyTimes.stream().mapToLong(Long::longValue).average().orElse(0));
            result.put("p50LatencyMs", latencyTimes.get((int)(latencyTimes.size() * 0.5)));
            result.put("p95LatencyMs", latencyTimes.get((int)(latencyTimes.size() * 0.95)));
            result.put("p99LatencyMs", latencyTimes.get((int)(latencyTimes.size() * 0.99)));
        }
        
        return Result.success(result);
    }
    
    @CircuitBreaker(name = "orderService", fallbackMethod = "orderFallback")
    @GetMapping("/order")
    public Result<?> getOrder(@RequestParam String orderId) {
        Map<String, Object> order = new HashMap<>();
        order.put("orderId", orderId);
        order.put("status", "PROCESSING");
        order.put("total", 999.99);
        order.put("items", 3);
        
        return Result.success(order);
    }
    
    public Result<?> orderFallback(String orderId, Exception e) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("orderId", orderId);
        fallback.put("status", "UNKNOWN");
        fallback.put("message", "Using cached data due to service unavailability");
        
        return Result.fallback("Order service unavailable: " + e.getMessage());
    }
}
