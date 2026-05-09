package com.resiliencehub.circuitbreaker;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class CircuitBreakerService {
    
    private final Map<String, CircuitBreaker> circuitBreakers = new ConcurrentHashMap<>();
    
    public CircuitBreaker getOrCreate(String name, CircuitBreakerConfig config) {
        return circuitBreakers.computeIfAbsent(name, k -> new CircuitBreaker(name, config));
    }
    
    public CircuitBreaker get(String name) {
        return circuitBreakers.get(name);
    }
    
    public CircuitBreakerMetrics getMetrics(String name) {
        CircuitBreaker cb = circuitBreakers.get(name);
        if (cb == null) {
            return null;
        }
        return cb.getMetrics();
    }
    
    public void reset(String name) {
        CircuitBreaker cb = circuitBreakers.get(name);
        if (cb != null) {
            cb.reset();
        }
    }
    
    public void transitionToClosed(String name) {
        CircuitBreaker cb = circuitBreakers.get(name);
        if (cb != null) {
            cb.transitionToClosed();
        }
    }
    
    public Map<String, CircuitBreaker> getAllCircuitBreakers() {
        return circuitBreakers;
    }
    
    public static class CircuitBreakerConfig {
        private int slidingWindowSize = 100;
        private int minimumNumberOfCalls = 10;
        private int failureRateThreshold = 50;
        private int slowCallRateThreshold = 50;
        private int slowCallDurationThreshold = 2000;
        private int waitDurationInOpenState = 10000;
        private int permittedNumberOfCallsInHalfOpenState = 3;
        private boolean automaticTransitionFromOpenToHalfOpen = true;
        
        public static CircuitBreakerConfig defaultConfig() {
            return new CircuitBreakerConfig();
        }
        
        public int getSlidingWindowSize() { return slidingWindowSize; }
        public void setSlidingWindowSize(int slidingWindowSize) { this.slidingWindowSize = slidingWindowSize; }
        public int getMinimumNumberOfCalls() { return minimumNumberOfCalls; }
        public void setMinimumNumberOfCalls(int minimumNumberOfCalls) { this.minimumNumberOfCalls = minimumNumberOfCalls; }
        public int getFailureRateThreshold() { return failureRateThreshold; }
        public void setFailureRateThreshold(int failureRateThreshold) { this.failureRateThreshold = failureRateThreshold; }
        public int getSlowCallRateThreshold() { return slowCallRateThreshold; }
        public void setSlowCallRateThreshold(int slowCallRateThreshold) { this.slowCallRateThreshold = slowCallRateThreshold; }
        public int getSlowCallDurationThreshold() { return slowCallDurationThreshold; }
        public void setSlowCallDurationThreshold(int slowCallDurationThreshold) { this.slowCallDurationThreshold = slowCallDurationThreshold; }
        public int getWaitDurationInOpenState() { return waitDurationInOpenState; }
        public void setWaitDurationInOpenState(int waitDurationInOpenState) { this.waitDurationInOpenState = waitDurationInOpenState; }
        public int getPermittedNumberOfCallsInHalfOpenState() { return permittedNumberOfCallsInHalfOpenState; }
        public void setPermittedNumberOfCallsInHalfOpenState(int permittedNumberOfCallsInHalfOpenState) { this.permittedNumberOfCallsInHalfOpenState = permittedNumberOfCallsInHalfOpenState; }
        public boolean isAutomaticTransitionFromOpenToHalfOpen() { return automaticTransitionFromOpenToHalfOpen; }
        public void setAutomaticTransitionFromOpenToHalfOpen(boolean automaticTransitionFromOpenToHalfOpen) { this.automaticTransitionFromOpenToHalfOpen = automaticTransitionFromOpenToHalfOpen; }
    }
    
    public enum CircuitState {
        CLOSED,
        OPEN,
        HALF_OPEN,
        DISABLED,
        FORCED_OPEN
    }
    
    public static class CircuitBreaker {
        private final String name;
        private final CircuitBreakerConfig config;
        private volatile CircuitState state;
        private volatile long openStartTime;
        private final AtomicInteger successCount = new AtomicInteger(0);
        private final AtomicInteger failureCount = new AtomicInteger(0);
        private final AtomicInteger slowCallCount = new AtomicInteger(0);
        private final AtomicInteger totalCalls = new AtomicInteger(0);
        private final AtomicLong totalDuration = new AtomicLong(0);
        
        public CircuitBreaker(String name, CircuitBreakerConfig config) {
            this.name = name;
            this.config = config;
            this.state = CircuitState.CLOSED;
        }
        
        public boolean tryAcquirePermission() {
            switch (state) {
                case DISABLED:
                    return true;
                case FORCED_OPEN:
                    return false;
                case CLOSED:
                    return true;
                case OPEN:
                    if (config.isAutomaticTransitionFromOpenToHalfOpen()) {
                        long elapsed = System.currentTimeMillis() - openStartTime;
                        if (elapsed >= config.getWaitDurationInOpenState()) {
                            state = CircuitState.HALF_OPEN;
                            return true;
                        }
                    }
                    return false;
                case HALF_OPEN:
                    return true;
                default:
                    return false;
            }
        }
        
        public void onSuccess(long duration) {
            successCount.incrementAndGet();
            totalCalls.incrementAndGet();
            totalDuration.addAndGet(duration);
            recordCall(duration);
            
            if (state == CircuitState.HALF_OPEN) {
                if (shouldCloseCircuit()) {
                    transitionToClosed();
                }
            }
        }
        
        public void onFailure(long duration, Exception e) {
            failureCount.incrementAndGet();
            totalCalls.incrementAndGet();
            totalDuration.addAndGet(duration);
            recordCall(duration);
            
            if (shouldOpenCircuit()) {
                transitionToOpen();
            }
        }
        
        public void onSlowCall(long duration) {
            slowCallCount.incrementAndGet();
            recordCall(duration);
            
            if (shouldOpenCircuit()) {
                transitionToOpen();
            }
        }
        
        private void recordCall(long duration) {
            if (totalCalls.get() >= config.getMinimumNumberOfCalls()) {
                if (shouldOpenCircuit()) {
                    transitionToOpen();
                }
            }
        }
        
        private boolean shouldOpenCircuit() {
            if (totalCalls.get() < config.getMinimumNumberOfCalls()) {
                return false;
            }
            
            int total = totalCalls.get();
            int failures = failureCount.get();
            int slowCalls = slowCallCount.get();
            
            double failureRate = (double) failures / total * 100;
            double slowCallRate = (double) slowCalls / total * 100;
            
            return failureRate >= config.getFailureRateThreshold() ||
                   slowCallRate >= config.getSlowCallRateThreshold();
        }
        
        private boolean shouldCloseCircuit() {
            int halfOpenSuccessCount = successCount.get();
            int halfOpenTotalCount = totalCalls.get();
            
            if (halfOpenTotalCount >= config.getPermittedNumberOfCallsInHalfOpenState()) {
                double successRate = (double) halfOpenSuccessCount / halfOpenTotalCount * 100;
                return successRate >= (100 - config.getFailureRateThreshold());
            }
            return false;
        }
        
        public void transitionToOpen() {
            state = CircuitState.OPEN;
            openStartTime = System.currentTimeMillis();
            resetCounters();
        }
        
        public void transitionToClosed() {
            state = CircuitState.CLOSED;
            resetCounters();
        }
        
        public void transitionToHalfOpen() {
            state = CircuitState.HALF_OPEN;
            resetCounters();
        }
        
        public void reset() {
            state = CircuitState.CLOSED;
            resetCounters();
        }
        
        private void resetCounters() {
            successCount.set(0);
            failureCount.set(0);
            slowCallCount.set(0);
            totalCalls.set(0);
            totalDuration.set(0);
        }
        
        public CircuitState getState() {
            return state;
        }
        
        public CircuitBreakerMetrics getMetrics() {
            CircuitBreakerMetrics metrics = new CircuitBreakerMetrics();
            metrics.setName(name);
            metrics.setState(state);
            metrics.setSuccessCount(successCount.get());
            metrics.setFailureCount(failureCount.get());
            metrics.setSlowCallCount(slowCallCount.get());
            metrics.setTotalCalls(totalCalls.get());
            metrics.setOpenStartTime(openStartTime);
            metrics.setFailureRate(calculateRate(failureCount.get()));
            metrics.setSlowCallRate(calculateRate(slowCallCount.get()));
            metrics.setAverageResponseTime(totalCalls.get() > 0 ? (double) totalDuration.get() / totalCalls.get() : 0);
            return metrics;
        }
        
        private double calculateRate(int count) {
            int total = totalCalls.get();
            if (total == 0) return 0.0;
            return (double) count / total * 100;
        }
    }
    
    public static class CircuitBreakerMetrics {
        private String name;
        private CircuitState state;
        private int successCount;
        private int failureCount;
        private int slowCallCount;
        private int totalCalls;
        private long openStartTime;
        private double failureRate;
        private double slowCallRate;
        private double averageResponseTime;
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public CircuitState getState() { return state; }
        public void setState(CircuitState state) { this.state = state; }
        public int getSuccessCount() { return successCount; }
        public void setSuccessCount(int successCount) { this.successCount = successCount; }
        public int getFailureCount() { return failureCount; }
        public void setFailureCount(int failureCount) { this.failureCount = failureCount; }
        public int getSlowCallCount() { return slowCallCount; }
        public void setSlowCallCount(int slowCallCount) { this.slowCallCount = slowCallCount; }
        public int getTotalCalls() { return totalCalls; }
        public void setTotalCalls(int totalCalls) { this.totalCalls = totalCalls; }
        public long getOpenStartTime() { return openStartTime; }
        public void setOpenStartTime(long openStartTime) { this.openStartTime = openStartTime; }
        public double getFailureRate() { return failureRate; }
        public void setFailureRate(double failureRate) { this.failureRate = failureRate; }
        public double getSlowCallRate() { return slowCallRate; }
        public void setSlowCallRate(double slowCallRate) { this.slowCallRate = slowCallRate; }
        public double getAverageResponseTime() { return averageResponseTime; }
        public void setAverageResponseTime(double averageResponseTime) { this.averageResponseTime = averageResponseTime; }
    }
}
