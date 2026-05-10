package com.example.config.service;

import com.example.config.domain.*;
import com.example.config.domain.ClientPushStatus.PushStatus;
import com.example.config.domain.ConfigRelease.ReleaseStatus;
import com.example.config.repository.ClientPushStatusRepository;
import com.example.config.util.CollectionUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    private final WebSocketService webSocketService;
    private final ConfigService configService;
    private final ClientPushStatusRepository pushStatusRepository;
    private final EventLogService eventLogService;
    private final StringRedisTemplate redisTemplate;
    private final AckManager ackManager;

    @Value("${config.hot-update.push.timeout-seconds:30}")
    private int pushTimeoutSeconds;

    @Value("${config.hot-update.push.max-retry-count:5}")
    private int maxRetryCount;

    @Value("${config.hot-update.push.retry-backoff-milliseconds:1000}")
    private long retryBackoffMs;

    @Value("${config.hot-update.push.concurrency:10}")
    private int pushConcurrency;

    @Value("${config.hot-update.idempotent.enabled:true}")
    private boolean idempotentEnabled;

    @Value("${config.hot-update.idempotent.ttl-seconds:600}")
    private int idempotentTtlSeconds;

    private final ExecutorService pushExecutor = new ThreadPoolExecutor(
            5, 50, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            new ThreadFactory() {
                private final AtomicInteger counter = new AtomicInteger(0);
                @Override
                public Thread newThread(Runnable r) {
                    Thread t = new Thread(r, "config-push-" + counter.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                }
            }
    );

    private static final String IDEMPOTENT_KEY_PREFIX = "idempotent:push:";

    @Transactional
    public void startPush(String releaseId) {
        ConfigRelease release = configService.getRelease(releaseId)
                .orElseThrow(() -> new IllegalArgumentException("发布记录不存在: " + releaseId));

        if (release.getStatus() != ReleaseStatus.PENDING) {
            log.warn("发布状态不是PENDING: releaseId={}, status={}", releaseId, release.getStatus());
            return;
        }

        configService.updateReleaseStatus(releaseId, ReleaseStatus.PUBLISHING);

        List<ClientRegistry> clients = webSocketService.getSubscribedClients(release.getNamespace());

        if (clients.isEmpty()) {
            log.info("没有订阅的客户端，直接标记成功: releaseId={}", releaseId);
            configService.updateReleaseStatus(releaseId, ReleaseStatus.SUCCESS);
            return;
        }

        for (ClientRegistry client : clients) {
            ClientPushStatus status = ClientPushStatus.builder()
                    .releaseId(releaseId)
                    .instanceId(client.getInstanceId())
                    .configKey(release.getConfigKey())
                    .targetVersion(release.getToVersion())
                    .status(PushStatus.PENDING)
                    .retryCount(0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            pushStatusRepository.save(status);
        }

        log.info("开始推送配置: releaseId={}, clientCount={}", releaseId, clients.size());

        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (ClientRegistry client : clients) {
            futures.add(CompletableFuture.runAsync(
                    () -> pushToClientWithRetry(releaseId, client.getInstanceId()),
                    pushExecutor
            ));
        }

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                .thenRun(() -> checkReleaseStatus(releaseId));
    }

    private void pushToClientWithRetry(String releaseId, String instanceId) {
        String idempotentKey = IDEMPOTENT_KEY_PREFIX + releaseId + ":" + instanceId;

        if (idempotentEnabled) {
            try {
                Boolean setIfAbsent = redisTemplate.opsForValue()
                        .setIfAbsent(idempotentKey, "processing", idempotentTtlSeconds, TimeUnit.SECONDS);
                if (Boolean.FALSE.equals(setIfAbsent)) {
                    log.info("跳过重复推送: releaseId={}, instanceId={}", releaseId, instanceId);
                    return;
                }
            } catch (Exception e) {
                log.warn("Redis幂等检查失败，继续执行: {}", e.getMessage());
            }
        }

        int attempt = 0;
        while (attempt < maxRetryCount) {
            attempt++;
            AckManager.AckFuture ackFuture = null;

            try {
                Optional<ClientPushStatus> statusOpt = pushStatusRepository
                        .findByReleaseIdAndInstanceId(releaseId, instanceId);
                if (!statusOpt.isPresent()) {
                    log.error("推送状态不存在: releaseId={}, instanceId={}", releaseId, instanceId);
                    return;
                }

                ClientPushStatus status = statusOpt.get();

                if (status.getStatus() == PushStatus.SUCCESS) {
                    log.info("已成功推送，跳过: releaseId={}, instanceId={}", releaseId, instanceId);
                    return;
                }

                status.setStatus(PushStatus.SENDING);
                status.setRetryCount(attempt);
                pushStatusRepository.save(status);

                eventLogService.logPushStart(releaseId, instanceId);

                ConfigRelease release = configService.getRelease(releaseId)
                        .orElseThrow(() -> new IllegalStateException("发布记录丢失: " + releaseId));

                Optional<ConfigItem> configOpt = configService.getConfig(release.getNamespace(), release.getConfigKey());
                if (!configOpt.isPresent()) {
                    throw new IllegalStateException("配置不存在: " + release.getNamespace() + "/" + release.getConfigKey());
                }

                ConfigItem config = configOpt.get();

                Map<String, Object> pushMessage = new HashMap<>();
                pushMessage.put("type", "CONFIG_UPDATE");
                pushMessage.put("releaseId", releaseId);
                pushMessage.put("namespace", release.getNamespace());
                pushMessage.put("key", release.getConfigKey());
                pushMessage.put("value", config.getConfigValue());
                pushMessage.put("version", config.getVersion());
                pushMessage.put("timestamp", System.currentTimeMillis());

                ackFuture = ackManager.createAckWaiter(releaseId, instanceId, pushTimeoutSeconds * 1000L);
                log.debug("创建ACK等待器: releaseId={}, instanceId={}, timeout={}s", releaseId, instanceId, pushTimeoutSeconds);

                long startTime = System.currentTimeMillis();
                boolean sendSuccess = webSocketService.pushToClient(instanceId, pushMessage);

                if (!sendSuccess) {
                    ackManager.cancelWaiter(releaseId, instanceId);
                    throw new RuntimeException("WebSocket发送失败，客户端可能已断开连接");
                }

                log.debug("等待ACK: releaseId={}, instanceId={}", releaseId, instanceId);

                AckManager.AckResult ackResult = ackFuture.waitForAck();
                long latency = System.currentTimeMillis() - startTime;

                if (ackResult.isSuccess()) {
                    status.setStatus(PushStatus.SUCCESS);
                    status.setSucceededAt(LocalDateTime.now());
                    pushStatusRepository.save(status);
                    eventLogService.logPushSuccess(releaseId, instanceId, latency);

                    try {
                        if (idempotentEnabled) {
                            redisTemplate.opsForValue().set(idempotentKey, "success", idempotentTtlSeconds, TimeUnit.SECONDS);
                        }
                    } catch (Exception e) {
                        log.warn("更新Redis幂等键失败: {}", e.getMessage());
                    }
                    return;

                } else if (ackResult.isTimeout()) {
                    log.warn("等待ACK超时: releaseId={}, instanceId={}, 耗时={}ms", releaseId, instanceId, latency);
                    throw new AckTimeoutException("等待ACK超时: " + latency + "ms", latency);

                } else {
                    String errorMsg = ackResult.getMessage() != null ? ackResult.getMessage() : "客户端返回失败";
                    log.warn("客户端ACK失败: releaseId={}, instanceId={}, error={}", releaseId, instanceId, errorMsg);
                    throw new RuntimeException("客户端ACK失败: " + errorMsg);
                }

            } catch (Exception e) {
                log.error("推送失败: releaseId={}, instanceId={}, attempt={}, error={}",
                        releaseId, instanceId, attempt, e.getMessage());

                boolean isTimeout = e instanceof AckTimeoutException;
                String errorMsg = e.getMessage();

                if (attempt >= maxRetryCount) {
                    ClientPushStatus status = pushStatusRepository
                            .findByReleaseIdAndInstanceId(releaseId, instanceId)
                            .orElse(new ClientPushStatus());
                    status.setStatus(isTimeout ? PushStatus.TIMEOUT : PushStatus.FAILED);
                    status.setLastError(errorMsg);
                    pushStatusRepository.save(status);
                    eventLogService.logPushFailed(releaseId, instanceId, errorMsg, e);
                } else {
                    ClientPushStatus status = pushStatusRepository
                            .findByReleaseIdAndInstanceId(releaseId, instanceId)
                            .orElse(new ClientPushStatus());
                    status.setStatus(isTimeout ? PushStatus.TIMEOUT : PushStatus.FAILED);
                    status.setLastError(errorMsg);
                    status.setNextRetryAt(LocalDateTime.now().plusMillis(retryBackoffMs * attempt));
                    pushStatusRepository.save(status);
                    eventLogService.logPushRetry(releaseId, instanceId, attempt + 1);

                    try {
                        Thread.sleep(retryBackoffMs * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        if (ackFuture != null) {
                            ackFuture.cancel();
                        }
                        return;
                    }
                }
            } finally {
                if (ackFuture != null && !ackFuture.isCompleted()) {
                    ackFuture.cancel();
                }
            }
        }
    }

    private static class AckTimeoutException extends RuntimeException {
        private final long latencyMs;

        public AckTimeoutException(String message, long latencyMs) {
            super(message);
            this.latencyMs = latencyMs;
        }

        public long getLatencyMs() {
            return latencyMs;
        }
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryFailedPushes() {
        LocalDateTime now = LocalDateTime.now();
        List<ClientPushStatus> retryable = pushStatusRepository.findRetryablePushStatuses(
                CollectionUtils.listOf(PushStatus.FAILED, PushStatus.TIMEOUT),
                now
        );

        if (retryable.isEmpty()) {
            return;
        }

        log.info("发现 {} 条可重试的推送记录", retryable.size());

        Set<String> releaseIds = new HashSet<>();
        for (ClientPushStatus status : retryable) {
            releaseIds.add(status.getReleaseId());
            pushExecutor.submit(() -> pushToClientWithRetry(status.getReleaseId(), status.getInstanceId()));
        }

        for (String releaseId : releaseIds) {
            pushExecutor.submit(() -> checkReleaseStatus(releaseId));
        }
    }

    @Transactional
    public void checkReleaseStatus(String releaseId) {
        List<ClientPushStatus> allStatuses = pushStatusRepository.findByReleaseId(releaseId);
        if (allStatuses.isEmpty()) {
            return;
        }

        long successCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.SUCCESS);
        long failedCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.FAILED);
        long timeoutCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.TIMEOUT);
        long sendingCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.SENDING);
        long pendingCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.PENDING);
        long skippedCount = pushStatusRepository.countByReleaseIdAndStatus(releaseId, PushStatus.SKIPPED);

        long inProgressCount = pendingCount + sendingCount;
        long totalFailedCount = failedCount + timeoutCount;

        log.info("检查发布状态: releaseId={}, total={}, success={}, failed={}, timeout={}, pending={}, sending={}, skipped={}",
                releaseId, allStatuses.size(), successCount, failedCount, timeoutCount, pendingCount, sendingCount, skippedCount);

        if (inProgressCount > 0) {
            configService.updateReleaseStatus(releaseId, ReleaseStatus.PUBLISHING);
        } else if (totalFailedCount == 0 && skippedCount == 0) {
            configService.updateReleaseStatus(releaseId, ReleaseStatus.SUCCESS);
        } else if (successCount == 0) {
            configService.updateReleaseStatusWithFailure(releaseId, ReleaseStatus.FAILED,
                    "全部客户端推送失败: " + totalFailedCount + "/" + allStatuses.size());
        } else {
            configService.updateReleaseStatus(releaseId, ReleaseStatus.PARTIAL_SUCCESS);
        }
    }

    public List<ClientPushStatus> getPushStatusesByRelease(String releaseId) {
        return pushStatusRepository.findByReleaseId(releaseId);
    }

    public List<ClientPushStatus> getPushStatusesByInstance(String instanceId) {
        return pushStatusRepository.findByInstanceIdOrderByUpdatedAtDesc(instanceId);
    }
}
