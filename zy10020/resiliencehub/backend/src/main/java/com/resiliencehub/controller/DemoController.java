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
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/v1/demo")
public class DemoController {
    
    private final RateLimitService rateLimitService;
    private final CircuitBreakerService circuitBreakerService;
    private final FaultInjector faultInjector;
    
    public DemoController(RateLimitService rateLimitService,
                         CircuitBreakerService circuitBreakerService,
                         FaultInjector faultInjector) {
        this.rateLimitService = rateLimitService;
        this.circuitBreakerService = circuitBreakerService;
        this.faultInjector = faultInjector;
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
        result.put("maxConcurrency", concurrency);
        result.put("traceId", TraceContext.getTraceId());
        
        int successCount = 0;
        int failCount = 0;
        int rateLimitedCount = 0;
        
        for (int i = 0; i < requests; i++) {
            boolean allowed = rateLimitService.tryAcquireTokenBucket(
                "high-concurrency-demo", 
                concurrency, 
                1);
            if (allowed) {
                try {
                    Thread.sleep(10);
                    successCount++;
                } catch (InterruptedException e) {
                    failCount++;
                }
            } else {
                rateLimitedCount++;
            }
        }
        
        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("rateLimitedCount", rateLimitedCount);
        
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
        
        Map<String, Object> result = new HashMap<>();
        result.put("totalRequests", totalRequests);
        result.put("concurrentUsers", concurrentUsers);
        result.put("qpsLimit", qpsLimit);
        result.put("traceId", TraceContext.getTraceId());
        
        int success = 0;
        int rateLimited = 0;
        long startTime = System.currentTimeMillis();
        
        for (int i = 0; i < totalRequests; i++) {
            boolean allowed = rateLimitService.tryAcquireSlidingWindow(limitKey, qpsLimit, 1);
            if (allowed) {
                success++;
            } else {
                rateLimited++;
            }
        }
        
        long duration = System.currentTimeMillis() - startTime;
        
        result.put("successCount", success);
        result.put("rateLimitedCount", rateLimited);
        result.put("durationMs", duration);
        result.put("actualQps", (double) totalRequests / (duration / 1000.0));
        
        rateLimitService.reset(limitKey);
        
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
