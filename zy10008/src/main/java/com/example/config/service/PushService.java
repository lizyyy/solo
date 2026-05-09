package com.example.config.service;

import com.example.config.domain.*;
import com.example.config.domain.ClientPushStatus.PushStatus;
import com.example.config.domain.ConfigRelease.ReleaseStatus;
import com.example.config.repository.ClientPushStatusRepository;
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
            Boolean setIfAbsent = redisTemplate.opsForValue()
                    .setIfAbsent(idempotentKey, "processing", idempotentTtlSeconds, TimeUnit.SECONDS);
            if (Boolean.FALSE.equals(setIfAbsent)) {
                log.info("跳过重复推送: releaseId={}, instanceId={}", releaseId, instanceId);
                return;
            }
        }

        int attempt = 0;
        while (attempt < maxRetryCount) {
            attempt++;

            try {
                Optional<ClientPushStatus> statusOpt = pushStatusRepository
                        .findByReleaseIdAndInstanceId(releaseId, instanceId);
                if (statusOpt.isEmpty()) {
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
                if (configOpt.isEmpty()) {
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

                long startTime = System.currentTimeMillis();
                boolean success = webSocketService.pushToClient(instanceId, pushMessage);
                long latency = System.currentTimeMillis() - startTime;

                if (success) {
                    status.setStatus(PushStatus.SUCCESS);
                    status.setSucceededAt(LocalDateTime.now());
                    pushStatusRepository.save(status);
                    eventLogService.logPushSuccess(releaseId, instanceId, latency);

                    if (idempotentEnabled) {
                        redisTemplate.opsForValue().set(idempotentKey, "success", idempotentTtlSeconds, TimeUnit.SECONDS);
                    }
                    return;
                } else {
                    throw new RuntimeException("WebSocket推送失败，客户端可能已断开连接");
                }

            } catch (Exception e) {
                log.error("推送失败: releaseId={}, instanceId={}, attempt={}, error={}",
                        releaseId, instanceId, attempt, e.getMessage());

                if (attempt >= maxRetryCount) {
                    ClientPushStatus status = pushStatusRepository
                            .findByReleaseIdAndInstanceId(releaseId, instanceId)
                            .orElse(new ClientPushStatus());
                    status.setStatus(PushStatus.FAILED);
                    status.setLastError(e.getMessage());
                    pushStatusRepository.save(status);
                    eventLogService.logPushFailed(releaseId, instanceId, e.getMessage(), e);
                } else {
                    ClientPushStatus status = pushStatusRepository
                            .findByReleaseIdAndInstanceId(releaseId, instanceId)
                            .orElse(new ClientPushStatus());
                    status.setStatus(PushStatus.FAILED);
                    status.setLastError(e.getMessage());
                    status.setNextRetryAt(LocalDateTime.now().plusMillis(retryBackoffMs * attempt));
                    pushStatusRepository.save(status);
                    eventLogService.logPushRetry(releaseId, instanceId, attempt + 1);

                    try {
                        Thread.sleep(retryBackoffMs * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
        }
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryFailedPushes() {
        LocalDateTime now = LocalDateTime.now();
        List<ClientPushStatus> retryable = pushStatusRepository.findRetryablePushStatuses(
                List.of(PushStatus.FAILED, PushStatus.TIMEOUT),
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
        long pendingCount = allStatuses.size() - successCount - failedCount;

        log.info("检查发布状态: releaseId={}, total={}, success={}, failed={}, pending={}",
                releaseId, allStatuses.size(), successCount, failedCount, pendingCount);

        if (pendingCount > 0) {
            configService.updateReleaseStatus(releaseId, ReleaseStatus.PUBLISHING);
        } else if (failedCount == 0) {
            configService.updateReleaseStatus(releaseId, ReleaseStatus.SUCCESS);
        } else if (successCount == 0) {
            configService.updateReleaseStatusWithFailure(releaseId, ReleaseStatus.FAILED,
                    "全部客户端推送失败: " + failedCount + "/" + allStatuses.size());
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
