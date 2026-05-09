package com.example.config.service;

import com.example.config.domain.ConfigItem;
import com.example.config.domain.ConfigRelease;
import com.example.config.repository.ConfigItemRepository;
import com.example.config.repository.ConfigReleaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfigService {

    private final ConfigItemRepository configItemRepository;
    private final ConfigReleaseRepository configReleaseRepository;
    private final EventLogService eventLogService;
    private final CacheService cacheService;

    public Optional<ConfigItem> getConfig(String namespace, String key) {
        return configItemRepository.findByNamespaceAndConfigKey(namespace, key);
    }

    public List<ConfigItem> getConfigsByNamespace(String namespace) {
        return configItemRepository.findActiveByNamespace(namespace);
    }

    @Transactional
    public ConfigItem createConfig(String namespace, String key, String value,
                                   String description, String operator) {
        Optional<ConfigItem> existing = configItemRepository.findByNamespaceAndConfigKey(namespace, key);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("配置已存在: " + namespace + "/" + key);
        }

        ConfigItem configItem = ConfigItem.builder()
                .namespace(namespace)
                .configKey(key)
                .configValue(value)
                .description(description)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1L)
                .enabled(true)
                .build();

        ConfigItem saved = configItemRepository.save(configItem);
        eventLogService.logConfigCreate(namespace, key, operator);

        return saved;
    }

    @Transactional
    public ConfigItem updateConfig(String namespace, String key, String newValue,
                                   String description, String operator) {
        ConfigItem configItem = configItemRepository.findByNamespaceAndConfigKey(namespace, key)
                .orElseThrow(() -> new IllegalArgumentException("配置不存在: " + namespace + "/" + key));

        Long fromVersion = configItem.getVersion();
        configItem.setConfigValue(newValue);
        if (description != null) {
            configItem.setDescription(description);
        }
        configItem.setUpdatedBy(operator);

        ConfigItem saved = configItemRepository.save(configItem);
        eventLogService.logConfigUpdate(namespace, key, fromVersion, saved.getVersion(), operator);

        cacheService.invalidateConfig(namespace, key);

        return saved;
    }

    @Transactional
    public ConfigRelease publishConfig(String namespace, String key, String operator) {
        ConfigItem configItem = configItemRepository.findByNamespaceAndConfigKey(namespace, key)
                .orElseThrow(() -> new IllegalArgumentException("配置不存在: " + namespace + "/" + key));

        String releaseId = UUID.randomUUID().toString().replace("-", "");

        ConfigRelease release = ConfigRelease.builder()
                .releaseId(releaseId)
                .namespace(namespace)
                .configKey(key)
                .fromVersion(configItem.getVersion() - 1)
                .toVersion(configItem.getVersion())
                .status(ConfigRelease.ReleaseStatus.PENDING)
                .releasedBy(operator)
                .createdAt(LocalDateTime.now())
                .build();

        ConfigRelease saved = configReleaseRepository.save(release);
        eventLogService.logConfigPublish(releaseId, namespace, key, operator);

        return saved;
    }

    @Transactional
    public void updateReleaseStatus(String releaseId, ConfigRelease.ReleaseStatus status) {
        ConfigRelease release = configReleaseRepository.findByReleaseId(releaseId)
                .orElseThrow(() -> new IllegalArgumentException("发布记录不存在: " + releaseId));

        release.setStatus(status);
        if (status == ConfigRelease.ReleaseStatus.SUCCESS ||
            status == ConfigRelease.ReleaseStatus.FAILED ||
            status == ConfigRelease.ReleaseStatus.ROLLED_BACK) {
            release.setCompletedAt(LocalDateTime.now());
        }

        configReleaseRepository.save(release);
    }

    @Transactional
    public void updateReleaseStatusWithFailure(String releaseId, ConfigRelease.ReleaseStatus status, String failureReason) {
        ConfigRelease release = configReleaseRepository.findByReleaseId(releaseId)
                .orElseThrow(() -> new IllegalArgumentException("发布记录不存在: " + releaseId));

        release.setStatus(status);
        release.setFailureReason(failureReason);
        release.setCompletedAt(LocalDateTime.now());

        configReleaseRepository.save(release);
    }

    public Optional<ConfigRelease> getRelease(String releaseId) {
        return configReleaseRepository.findByReleaseId(releaseId);
    }

    public List<ConfigRelease> getReleasesByConfig(String namespace, String key) {
        return configReleaseRepository.findByNamespaceAndConfigKeyOrderByCreatedAtDesc(namespace, key);
    }

    public List<ConfigRelease> getReleasesByTimeRange(LocalDateTime from, LocalDateTime to) {
        return configReleaseRepository.findByTimeRange(from, to);
    }

    public List<ConfigRelease> getPendingOrInProgressReleases() {
        LocalDateTime from = LocalDateTime.now().minusHours(24);
        return configReleaseRepository.findPendingOrInProgress(
                List.of(ConfigRelease.ReleaseStatus.PENDING, ConfigRelease.ReleaseStatus.PUBLISHING),
                from);
    }
}
