package com.example.config.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.*;

@Slf4j
@Component
public class AckManager {

    private final Map<String, AckFuture> pendingAcks = new ConcurrentHashMap<>();

    public AckFuture createAckWaiter(String releaseId, String instanceId, long timeoutMillis) {
        String key = buildKey(releaseId, instanceId);
        AckFuture future = new AckFuture(key, timeoutMillis);
        pendingAcks.put(key, future);
        log.debug("创建ACK等待器: key={}, timeout={}ms", key, timeoutMillis);
        return future;
    }

    public void notifyAck(String releaseId, String instanceId, boolean success, String errorMessage) {
        String key = buildKey(releaseId, instanceId);
        AckFuture future = pendingAcks.remove(key);
        if (future != null) {
            future.complete(success, errorMessage);
            log.debug("收到ACK: key={}, success={}", key, success);
        } else {
            log.debug("收到ACK但无等待器: key={}", key);
        }
    }

    public void cancelWaiter(String releaseId, String instanceId) {
        String key = buildKey(releaseId, instanceId);
        AckFuture future = pendingAcks.remove(key);
        if (future != null) {
            future.cancel();
        }
    }

    public boolean hasPendingAck(String releaseId, String instanceId) {
        return pendingAcks.containsKey(buildKey(releaseId, instanceId));
    }

    public int getPendingCount() {
        return pendingAcks.size();
    }

    private String buildKey(String releaseId, String instanceId) {
        return releaseId + ":" + instanceId;
    }

    public static class AckFuture {
        private final String key;
        private final long timeoutMillis;
        private final CountDownLatch latch = new CountDownLatch(1);
        private volatile boolean completed = false;
        private volatile boolean success = false;
        private volatile String errorMessage = null;

        public AckFuture(String key, long timeoutMillis) {
            this.key = key;
            this.timeoutMillis = timeoutMillis;
        }

        public AckResult waitForAck() {
            try {
                boolean received = latch.await(timeoutMillis, TimeUnit.MILLISECONDS);
                if (!received) {
                    return AckResult.timeout("等待ACK超时: " + timeoutMillis + "ms");
                }
                if (success) {
                    return AckResult.success();
                } else {
                    return AckResult.failed(errorMessage);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return AckResult.failed("等待ACK被中断");
            }
        }

        public void complete(boolean success, String errorMessage) {
            this.completed = true;
            this.success = success;
            this.errorMessage = errorMessage;
            latch.countDown();
        }

        public void cancel() {
            this.completed = true;
            this.success = false;
            this.errorMessage = "等待被取消";
            latch.countDown();
        }

        public boolean isCompleted() {
            return completed;
        }

        public String getKey() {
            return key;
        }
    }

    public static class AckResult {
        private final Status status;
        private final String message;

        private AckResult(Status status, String message) {
            this.status = status;
            this.message = message;
        }

        public static AckResult success() {
            return new AckResult(Status.SUCCESS, null);
        }

        public static AckResult failed(String message) {
            return new AckResult(Status.FAILED, message);
        }

        public static AckResult timeout(String message) {
            return new AckResult(Status.TIMEOUT, message);
        }

        public Status getStatus() {
            return status;
        }

        public String getMessage() {
            return message;
        }

        public boolean isSuccess() {
            return status == Status.SUCCESS;
        }

        public boolean isTimeout() {
            return status == Status.TIMEOUT;
        }

        public boolean isFailed() {
            return status == Status.FAILED;
        }

        public enum Status {
            SUCCESS, FAILED, TIMEOUT
        }
    }
}
