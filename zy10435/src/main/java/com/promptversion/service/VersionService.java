package com.promptversion.service;

import com.alibaba.fastjson.JSON;
import com.promptversion.dto.CreateVersionRequest;
import com.promptversion.dto.RollbackRequest;
import com.promptversion.entity.ExceptionLog;
import com.promptversion.entity.RollbackEvent;
import com.promptversion.entity.TemplateVersion;
import com.promptversion.enums.RollbackType;
import com.promptversion.enums.VersionStatus;
import com.promptversion.exception.BusinessException;
import com.promptversion.repository.ExceptionLogRepository;
import com.promptversion.repository.RollbackEventRepository;
import com.promptversion.repository.TemplateVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class VersionService {

    @Autowired
    private TemplateVersionRepository versionRepository;

    @Autowired
    private RollbackEventRepository rollbackEventRepository;

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @Transactional
    public TemplateVersion createVersion(CreateVersionRequest request) {
        try {
            if (versionRepository.existsByTemplateIdAndVersionNumber(
                    request.getTemplateId(), request.getVersionNumber())) {
                throw new BusinessException(400, "该模板下已存在相同版本号", JSON.toJSONString(request));
            }

            TemplateVersion version = new TemplateVersion();
            version.setTemplateId(request.getTemplateId());
            version.setVersionNumber(request.getVersionNumber());
            version.setContent(request.getContent());
            version.setTrafficPercentage(request.getTrafficPercentage() != null ?
                    request.getTrafficPercentage() : BigDecimal.ZERO);
            version.setPublishedBy(request.getPublishedBy());
            version.setRemark(request.getRemark());
            version.setStatus(VersionStatus.DRAFT);

            return versionRepository.save(version);
        } catch (BusinessException e) {
            saveExceptionLog("CREATE_VERSION", JSON.toJSONString(request), e.getMessage(), request.getPublishedBy(), null);
            throw e;
        } catch (Exception e) {
            saveExceptionLog("CREATE_VERSION", JSON.toJSONString(request), e.getMessage(), request.getPublishedBy(), e);
            throw new BusinessException(500, "创建版本失败: " + e.getMessage());
        }
    }

    @Transactional
    public TemplateVersion publishVersion(Long versionId) {
        TemplateVersion version = getVersionById(versionId);

        if (version.getStatus() != VersionStatus.DRAFT) {
            throw new BusinessException(400, "只有草稿状态的版本才能发布");
        }

        version.setStatus(VersionStatus.PUBLISHED);
        version.setPublishedAt(LocalDateTime.now());
        return versionRepository.save(version);
    }

    @Transactional
    public TemplateVersion activateVersion(Long versionId) {
        TemplateVersion version = getVersionById(versionId);

        if (version.getStatus() != VersionStatus.PUBLISHED) {
            throw new BusinessException(400, "只有已发布状态的版本才能激活");
        }

        version.setStatus(VersionStatus.ACTIVE);
        version.setActivatedAt(LocalDateTime.now());
        return versionRepository.save(version);
    }

    @Transactional
    public TemplateVersion updateTraffic(Long versionId, BigDecimal trafficPercentage) {
        TemplateVersion version = getVersionById(versionId);

        if (version.getStatus() != VersionStatus.ACTIVE) {
            throw new BusinessException(400, "只有激活状态的版本才能更新流量");
        }

        if (trafficPercentage.compareTo(BigDecimal.ZERO) < 0 || trafficPercentage.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException(400, "流量百分比必须在0-100之间");
        }

        version.setTrafficPercentage(trafficPercentage);
        return versionRepository.save(version);
    }

    @Transactional
    public RollbackEvent rollback(RollbackRequest request) {
        TemplateVersion currentVersion = getVersionById(request.getVersionId());

        if (rollbackEventRepository.existsByVersionIdAndProcessedFalse(request.getVersionId())) {
            throw new BusinessException(400, "该版本已有待处理的回滚事件，请勿重复提交");
        }

        RollbackEvent event = new RollbackEvent();
        event.setTemplateId(currentVersion.getTemplateId());
        event.setVersionId(request.getVersionId());
        event.setRollbackType(request.getRollbackType());
        event.setOperator(request.getOperator());
        event.setReason(request.getReason());
        event.setPreviousVersionId(request.getTargetVersionId());

        RollbackEvent savedEvent = rollbackEventRepository.save(event);

        processRollback(savedEvent);

        return savedEvent;
    }

    @Transactional
    public void processRollback(RollbackEvent event) {
        if (event.getProcessed()) {
            return;
        }

        TemplateVersion currentVersion = getVersionById(event.getVersionId());
        if (currentVersion.getStatus() == VersionStatus.ROLLED_BACK) {
            event.setProcessed(true);
            rollbackEventRepository.save(event);
            return;
        }

        currentVersion.setStatus(VersionStatus.ROLLED_BACK);
        currentVersion.setRolledBackAt(LocalDateTime.now());
        versionRepository.save(currentVersion);

        if (event.getPreviousVersionId() != null) {
            TemplateVersion targetVersion = getVersionById(event.getPreviousVersionId());
            if (targetVersion.getStatus() == VersionStatus.ROLLED_BACK) {
                targetVersion.setStatus(VersionStatus.ACTIVE);
                versionRepository.save(targetVersion);
            }
        }

        event.setProcessed(true);
        rollbackEventRepository.save(event);
    }

    public List<TemplateVersion> getVersionsByTemplateId(Long templateId) {
        return versionRepository.findByTemplateIdOrderByCreatedAtDesc(templateId);
    }

    public List<TemplateVersion> getActiveVersions(Long templateId) {
        return versionRepository.findActiveVersionsByTemplateId(templateId);
    }

    public TemplateVersion getVersionById(Long versionId) {
        return versionRepository.findById(versionId)
                .orElseThrow(() -> new BusinessException(404, "版本不存在"));
    }

    public TemplateVersion selectVersionByTraffic(Long templateId, String userId) {
        List<TemplateVersion> activeVersions = versionRepository.findActiveVersionsByTemplateId(templateId);
        if (activeVersions.isEmpty()) {
            throw new BusinessException(404, "没有可用的激活版本");
        }

        int userHash = Math.abs(userId.hashCode());
        int bucket = userHash % 100;
        int cumulative = 0;

        for (TemplateVersion version : activeVersions) {
            cumulative += version.getTrafficPercentage().intValue();
            if (bucket < cumulative) {
                return version;
            }
        }

        return activeVersions.get(activeVersions.size() - 1);
    }

    private void saveExceptionLog(String operationType, String originalInput, String errorMessage, String operator, Exception e) {
        ExceptionLog log = new ExceptionLog();
        log.setOperationType(operationType);
        log.setOriginalInput(originalInput);
        log.setErrorMessage(errorMessage);
        log.setOperator(operator);
        if (e != null) {
            log.setStackTrace(getStackTrace(e));
        }
        log.setConclusion("操作失败，已记录异常日志");
        exceptionLogRepository.save(log);
    }

    private String getStackTrace(Exception e) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : e.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }
}