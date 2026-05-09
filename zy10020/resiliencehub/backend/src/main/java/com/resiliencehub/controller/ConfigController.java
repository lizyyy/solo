package com.resiliencehub.controller;

import com.resiliencehub.common.Result;
import com.resiliencehub.circuitbreaker.CircuitBreakerService;
import com.resiliencehub.fault.FaultInjector;
import com.resiliencehub.message.MessageService;
import com.resiliencehub.ratelimit.RateLimitService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/config")
public class ConfigController {
    
    private final RateLimitService rateLimitService;
    private final CircuitBreakerService circuitBreakerService;
    private final FaultInjector faultInjector;
    private final MessageService messageService;
    
    public ConfigController(RateLimitService rateLimitService,
                          CircuitBreakerService circuitBreakerService,
                          FaultInjector faultInjector,
                          MessageService messageService) {
        this.rateLimitService = rateLimitService;
        this.circuitBreakerService = circuitBreakerService;
        this.faultInjector = faultInjector;
        this.messageService = messageService;
    }
    
    @PostMapping("/rate-limit/{key}")
    public Result<?> configureRateLimit(@PathVariable String key,
                                        @RequestBody RateLimitConfig config) {
        rateLimitService.reset(key);
        return Result.success("Rate limit configured for: " + key);
    }
    
    @GetMapping("/rate-limit/{key}")
    public Result<RateLimitService.RateLimitMetrics> getRateLimitMetrics(@PathVariable String key) {
        return Result.success(rateLimitService.getMetrics(key));
    }
    
    @PostMapping("/circuit-breaker/{name}")
    public Result<?> configureCircuitBreaker(@PathVariable String name,
                                             @RequestBody CircuitBreakerService.CircuitBreakerConfig config) {
        circuitBreakerService.getOrCreate(name, config);
        return Result.success("Circuit breaker configured for: " + name);
    }
    
    @GetMapping("/circuit-breaker/{name}")
    public Result<CircuitBreakerService.CircuitBreakerMetrics> getCircuitBreakerMetrics(@PathVariable String name) {
        CircuitBreakerService.CircuitBreakerMetrics metrics = circuitBreakerService.getMetrics(name);
        if (metrics == null) {
            return Result.error("Circuit breaker not found: " + name);
        }
        return Result.success(metrics);
    }
    
    @GetMapping("/circuit-breakers")
    public Result<Map<String, CircuitBreakerService.CircuitBreakerMetrics>> getAllCircuitBreakers() {
        Map<String, CircuitBreakerService.CircuitBreakerMetrics> metrics = 
            circuitBreakerService.getAllCircuitBreakers().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().getMetrics()));
        return Result.success(metrics);
    }
    
    @PostMapping("/circuit-breaker/{name}/reset")
    public Result<?> resetCircuitBreaker(@PathVariable String name) {
        circuitBreakerService.reset(name);
        return Result.success("Circuit breaker reset: " + name);
    }
    
    @PostMapping("/circuit-breaker/{name}/close")
    public Result<?> closeCircuitBreaker(@PathVariable String name) {
        circuitBreakerService.transitionToClosed(name);
        return Result.success("Circuit breaker transitioned to CLOSED: " + name);
    }
    
    @PostMapping("/fault/{endpoint}")
    public Result<?> configureFault(@PathVariable String endpoint,
                                   @RequestBody FaultInjector.FaultConfig config) {
        config.setEndpoint(endpoint);
        faultInjector.configureFault(endpoint, config);
        return Result.success("Fault configured for: " + endpoint);
    }
    
    @GetMapping("/fault/{endpoint}")
    public Result<FaultInjector.FaultConfig> getFaultConfig(@PathVariable String endpoint) {
        FaultInjector.FaultConfig config = faultInjector.getFaultConfig(endpoint);
        if (config == null) {
            return Result.error("Fault config not found: " + endpoint);
        }
        return Result.success(config);
    }
    
    @GetMapping("/faults")
    public Result<Map<String, FaultInjector.FaultConfig>> getAllFaultConfigs() {
        return Result.success(faultInjector.getAllFaultConfigs());
    }
    
    @DeleteMapping("/fault/{endpoint}")
    public Result<?> removeFaultConfig(@PathVariable String endpoint) {
        faultInjector.removeFaultConfig(endpoint);
        return Result.success("Fault config removed: " + endpoint);
    }
    
    @PostMapping("/faults/reset")
    public Result<?> resetAllFaults() {
        faultInjector.resetAll();
        return Result.success("All fault configurations reset");
    }
    
    @PostMapping("/message-fault/{queue}")
    public Result<?> configureMessageFault(@PathVariable String queue,
                                          @RequestBody MessageService.MessageFaultConfig config) {
        config.setQueueName(queue);
        messageService.configureMessageFault(queue, config);
        return Result.success("Message fault configured for queue: " + queue);
    }
    
    @GetMapping("/message-fault/{queue}")
    public Result<MessageService.MessageFaultConfig> getMessageFaultConfig(@PathVariable String queue) {
        MessageService.MessageFaultConfig config = messageService.getMessageFaultConfig(queue);
        if (config == null) {
            return Result.error("Message fault config not found: " + queue);
        }
        return Result.success(config);
    }
    
    @GetMapping("/system/overview")
    public Result<Map<String, Object>> getSystemOverview() {
        Map<String, Object> overview = new HashMap<>();
        
        overview.put("circuitBreakerCount", circuitBreakerService.getAllCircuitBreakers().size());
        overview.put("activeFaultConfigs", faultInjector.getAllFaultConfigs().size());
        overview.put("timestamp", java.time.LocalDateTime.now().toString());
        
        Map<String, Object> circuitBreakerStatus = new HashMap<>();
        circuitBreakerService.getAllCircuitBreakers().forEach((name, cb) -> {
            CircuitBreakerService.CircuitBreakerMetrics metrics = cb.getMetrics();
            Map<String, Object> status = new HashMap<>();
            status.put("state", metrics.getState());
            status.put("totalCalls", metrics.getTotalCalls());
            status.put("failureRate", metrics.getFailureRate());
            status.put("averageResponseTime", metrics.getAverageResponseTime());
            circuitBreakerStatus.put(name, status);
        });
        overview.put("circuitBreakers", circuitBreakerStatus);
        
        return Result.success(overview);
    }
    
    public static class RateLimitConfig {
        private int limit;
        private int window;
        private RateLimitService.RateLimitStrategy strategy;
        
        public int getLimit() { return limit; }
        public void setLimit(int limit) { this.limit = limit; }
        public int getWindow() { return window; }
        public void setWindow(int window) { this.window = window; }
        public RateLimitService.RateLimitStrategy getStrategy() { return strategy; }
        public void setStrategy(RateLimitService.RateLimitStrategy strategy) { this.strategy = strategy; }
    }
}
