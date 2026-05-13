package com.version.adapter.service;

import com.version.adapter.entity.ClientVersion;
import com.version.adapter.entity.enums.VersionStatus;
import com.version.adapter.exception.VersionAdapterException;
import com.version.adapter.repository.ClientVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClientVersionService {

    private final ClientVersionRepository clientVersionRepository;
    private final AuditTimelineService auditTimelineService;

    @Transactional
    public ClientVersion createClientVersion(ClientVersion version, String operator) {
        if (clientVersionRepository.existsByVersionNumber(version.getVersionNumber())) {
            throw new VersionAdapterException("VERSION_EXISTS", "版本号已存在: " + version.getVersionNumber());
        }

        version.setCreatedBy(operator);
        version.setStatus(VersionStatus.DRAFT);
        version.setIsDeprecated(false);
        version.setCreatedAt(LocalDateTime.now());

        ClientVersion saved = clientVersionRepository.save(version);

        auditTimelineService.recordAction(
                "ClientVersion", saved.getId(), "CREATE",
                null, saved, operator, "创建客户端版本"
        );

        log.info("创建客户端版本成功: {}", saved.getVersionNumber());
        return saved;
    }

    @Transactional
    public ClientVersion updateStatus(Long id, VersionStatus newStatus, String operator, String remarks) {
        ClientVersion version = clientVersionRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND", "版本不存在: " + id));

        ClientVersion previousState = new ClientVersion();
        previousState.setStatus(version.getStatus());

        version.setStatus(newStatus);
        version.setUpdatedBy(operator);
        version.setUpdatedAt(LocalDateTime.now());

        ClientVersion updated = clientVersionRepository.save(version);

        auditTimelineService.recordAction(
                "ClientVersion", id, "STATUS_UPDATE",
                previousState, updated, operator, remarks
        );

        log.info("更新版本状态成功: {} -> {}", version.getVersionNumber(), newStatus);
        return updated;
    }

    @Transactional
    public ClientVersion deprecateVersion(Long id, String reason, String operator) {
        ClientVersion version = clientVersionRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND", "版本不存在: " + id));

        ClientVersion previousState = new ClientVersion();
        previousState.setIsDeprecated(version.getIsDeprecated());

        version.setIsDeprecated(true);
        version.setDeprecatedReason(reason);
        version.setDeprecatedAt(LocalDateTime.now());
        version.setUpdatedBy(operator);
        version.setUpdatedAt(LocalDateTime.now());

        ClientVersion updated = clientVersionRepository.save(version);

        auditTimelineService.recordAction(
                "ClientVersion", id, "DEPRECATE",
                previousState, updated, operator, reason
        );

        log.info("弃用版本成功: {}", version.getVersionNumber());
        return updated;
    }

    public ClientVersion getByVersionNumber(String versionNumber) {
        return clientVersionRepository.findByVersionNumber(versionNumber)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND", "版本不存在: " + versionNumber));
    }

    public ClientVersion getById(Long id) {
        return clientVersionRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND", "版本不存在: " + id));
    }

    public List<ClientVersion> getAllVersions() {
        return clientVersionRepository.findAll();
    }

    public List<ClientVersion> getVersionsByStatus(VersionStatus status) {
        return clientVersionRepository.findByStatus(status);
    }

    public List<ClientVersion> getDeprecatedVersions() {
        return clientVersionRepository.findByIsDeprecatedTrue();
    }

    @Transactional
    public ClientVersion updateVersion(Long id, ClientVersion updateRequest, String operator) {
        ClientVersion existing = clientVersionRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND", "版本不存在: " + id));

        ClientVersion previousState = new ClientVersion();
        previousState.setDescription(existing.getDescription());
        previousState.setClientType(existing.getClientType());

        if (updateRequest.getDescription() != null) {
            existing.setDescription(updateRequest.getDescription());
        }
        if (updateRequest.getClientType() != null) {
            existing.setClientType(updateRequest.getClientType());
        }

        existing.setUpdatedBy(operator);
        existing.setUpdatedAt(LocalDateTime.now());

        ClientVersion updated = clientVersionRepository.save(existing);

        auditTimelineService.recordAction(
                "ClientVersion", id, "UPDATE",
                previousState, updated, operator, "更新版本信息"
        );

        return updated;
    }
}
