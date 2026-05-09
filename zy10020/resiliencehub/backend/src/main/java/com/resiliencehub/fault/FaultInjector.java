package com.resiliencehub.fault;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class FaultInjector {
    
    private final Map<String, FaultConfig> faultConfigs = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> executionCounts = new ConcurrentHashMap<>();
    private final Random random = new Random();
    
    public void injectFault(String endpoint) throws FaultException {
        FaultConfig config = faultConfigs.get(endpoint);
        if (config == null) {
            return;
        }
        
        AtomicInteger count = executionCounts.computeIfAbsent(endpoint, k -> new AtomicInteger(0));
        int executionNumber = count.incrementAndGet();
        
        if (config.isForceFail()) {
            throw new FaultException("强制故障注入: " + endpoint);
        }
        
        if (config.getDelayMs() > 0) {
            injectDelay(config.getDelayMs(), config.isRandomDelay());
        }
        
        if (shouldInject(config.getTimeoutProbability())) {
            throw new TimeoutException("模拟请求超时");
        }
        
        if (shouldInject(config.getErrorProbability())) {
            throw new FaultException("模拟服务器错误");
        }
        
        if (shouldInject(config.getNetworkErrorProbability())) {
            throw new NetworkException("模拟网络断开");
        }
        
        if (shouldInject(config.getDuplicateProbability())) {
            if (executionNumber % 2 == 0) {
                throw new DuplicateRequestException("模拟重复请求 - 第二个请求被拒绝");
            }
        }
        
        if (config.getHighConcurrencyThreshold() > 0) {
            checkConcurrency(config);
        }
    }
    
    private void injectDelay(long baseDelay, boolean randomDelay) {
        long delay = randomDelay ? baseDelay + random.nextInt((int) baseDelay) : baseDelay;
        try {
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FaultException("延迟注入被中断");
        }
    }
    
    private boolean shouldInject(double probability) {
        if (probability <= 0) return false;
        if (probability >= 1.0) return true;
        return random.nextDouble() < probability;
    }
    
    private void checkConcurrency(FaultConfig config) {
        AtomicInteger currentCount = executionCounts.computeIfAbsent(config.getEndpoint() + ":concurrent", k -> new AtomicInteger(0));
        int current = currentCount.incrementAndGet();
        
        try {
            if (current > config.getHighConcurrencyThreshold()) {
                throw new HighConcurrencyException("高并发限制: 当前并发数 " + current);
            }
            Thread.sleep(100);
        } finally {
            currentCount.decrementAndGet();
        }
    }
    
    public void configureFault(String endpoint, FaultConfig config) {
        faultConfigs.put(endpoint, config);
    }
    
    public FaultConfig getFaultConfig(String endpoint) {
        return faultConfigs.get(endpoint);
    }
    
    public Map<String, FaultConfig> getAllFaultConfigs() {
        return faultConfigs;
    }
    
    public void removeFaultConfig(String endpoint) {
        faultConfigs.remove(endpoint);
        executionCounts.remove(endpoint);
        executionCounts.remove(endpoint + ":concurrent");
    }
    
    public void resetAll() {
        faultConfigs.clear();
        executionCounts.clear();
    }
    
    public static class FaultConfig {
        private String endpoint;
        private boolean enabled = true;
        private boolean forceFail = false;
        private long delayMs = 0;
        private boolean randomDelay = false;
        private double timeoutProbability = 0.0;
        private double errorProbability = 0.0;
        private double networkErrorProbability = 0.0;
        private double duplicateProbability = 0.0;
        private int highConcurrencyThreshold = 0;
        private double slowCallProbability = 0.0;
        private long slowCallDurationMs = 3000;
        
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public boolean isForceFail() { return forceFail; }
        public void setForceFail(boolean forceFail) { this.forceFail = forceFail; }
        public long getDelayMs() { return delayMs; }
        public void setDelayMs(long delayMs) { this.delayMs = delayMs; }
        public boolean isRandomDelay() { return randomDelay; }
        public void setRandomDelay(boolean randomDelay) { this.randomDelay = randomDelay; }
        public double getTimeoutProbability() { return timeoutProbability; }
        public void setTimeoutProbability(double timeoutProbability) { this.timeoutProbability = timeoutProbability; }
        public double getErrorProbability() { return errorProbability; }
        public void setErrorProbability(double errorProbability) { this.errorProbability = errorProbability; }
        public double getNetworkErrorProbability() { return networkErrorProbability; }
        public void setNetworkErrorProbability(double networkErrorProbability) { this.networkErrorProbability = networkErrorProbability; }
        public double getDuplicateProbability() { return duplicateProbability; }
        public void setDuplicateProbability(double duplicateProbability) { this.duplicateProbability = duplicateProbability; }
        public int getHighConcurrencyThreshold() { return highConcurrencyThreshold; }
        public void setHighConcurrencyThreshold(int highConcurrencyThreshold) { this.highConcurrencyThreshold = highConcurrencyThreshold; }
        public double getSlowCallProbability() { return slowCallProbability; }
        public void setSlowCallProbability(double slowCallProbability) { this.slowCallProbability = slowCallProbability; }
        public long getSlowCallDurationMs() { return slowCallDurationMs; }
        public void setSlowCallDurationMs(long slowCallDurationMs) { this.slowCallDurationMs = slowCallDurationMs; }
    }
    
    public static class FaultException extends RuntimeException {
        public FaultException(String message) {
            super(message);
        }
        public FaultException(String message, Throwable cause) {
            super(message, cause);
        }
    }
    
    public static class TimeoutException extends FaultException {
        public TimeoutException(String message) {
            super(message);
        }
    }
    
    public static class NetworkException extends FaultException {
        public NetworkException(String message) {
            super(message);
        }
    }
    
    public static class DuplicateRequestException extends FaultException {
        public DuplicateRequestException(String message) {
            super(message);
        }
    }
    
    public static class HighConcurrencyException extends FaultException {
        public HighConcurrencyException(String message) {
            super(message);
        }
    }
}
