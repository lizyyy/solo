package com.package.repo.service;

import com.package.repo.model.dto.CreatePackageRequest;
import com.package.repo.model.entity.DependencyProject;
import com.package.repo.model.entity.OperationLog;
import com.package.repo.model.entity.PackageVersion;
import com.package.repo.model.enums.PackageStatus;
import com.package.repo.repository.OperationLogRepository;
import com.package.repo.repository.PackageVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PackageService {

    private final PackageVersionRepository packageVersionRepository;
    private final OperationLogRepository operationLogRepository;
    private final StateMachineService stateMachineService;

    @Transactional
    public PackageVersion createPackage(CreatePackageRequest request) {
        String resourceKey = request.getPackageName() + ":" + request.getVersion();

        if (packageVersionRepository.existsByPackageNameAndVersionAndDeletedFalse(
                request.getPackageName(), request.getVersion())) {
            log.warn("包版本已存在: {}", resourceKey);
            saveOperationLog("CREATE_PACKAGE", null, resourceKey,
                    request.getRawInput(), "包版本已存在", false, "Package already exists");
            throw new IllegalArgumentException("包版本已存在: " + resourceKey);
        }

        PackageVersion packageVersion = PackageVersion.builder()
                .packageName(request.getPackageName())
                .version(request.getVersion())
                .publisher(request.getPublisher())
                .description(request.getDescription())
                .status(PackageStatus.PUBLISHED)
                .rawInput(request.getRawInput())
                .build();

        if (request.getDependencyProjects() != null) {
            for (String projectName : request.getDependencyProjects()) {
                DependencyProject dep = DependencyProject.builder()
                        .packageVersion(packageVersion)
                        .projectName(projectName)
                        .build();
                packageVersion.getDependencyProjects().add(dep);
            }
        }

        PackageVersion saved = packageVersionRepository.save(packageVersion);
        saveOperationLog("CREATE_PACKAGE", request.getPublisher(), resourceKey,
                request.getRawInput(), "包创建成功", true, null);

        log.info("包创建成功: {}", resourceKey);
        return saved;
    }

    public Optional<PackageVersion> getPackage(String packageName, String version) {
        return packageVersionRepository.findByPackageNameAndVersionAndDeletedFalse(packageName, version);
    }

    public List<PackageVersion> getAllPackages() {
        return packageVersionRepository.findAllActive();
    }

    public List<PackageVersion> getPackagesByName(String packageName) {
        return packageVersionRepository.findByPackageNameAndDeletedFalseOrderByPublishTimeDesc(packageName);
    }

    public List<PackageVersion> getPackagesByStatus(PackageStatus status) {
        return packageVersionRepository.findByStatusAndDeletedFalse(status);
    }

    @Transactional
    public PackageVersion updatePackageStatus(Long id, PackageStatus newStatus, String reason, String operator) {
        PackageVersion packageVersion = packageVersionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("包不存在: " + id));

        PackageStatus oldStatus = packageVersion.getStatus();
        if (!stateMachineService.canTransition(oldStatus, newStatus)) {
            String errorMsg = String.format("无效的状态转换: %s -> %s", oldStatus, newStatus);
            saveOperationLog("STATUS_UPDATE", operator,
                    packageVersion.getPackageName() + ":" + packageVersion.getVersion(),
                    null, errorMsg, false, errorMsg);
            throw new IllegalStateException(errorMsg);
        }

        packageVersion.setStatus(newStatus);
        packageVersion.setLastStatusChangeTime(LocalDateTime.now());
        packageVersion.setStatusChangeReason(reason != null ? reason :
                stateMachineService.getTransitionReason(oldStatus, newStatus));

        PackageVersion saved = packageVersionRepository.save(packageVersion);
        saveOperationLog("STATUS_UPDATE", operator,
                packageVersion.getPackageName() + ":" + packageVersion.getVersion(),
                null, "状态更新成功: " + oldStatus + " -> " + newStatus, true, null);

        log.info("包状态更新成功: {} -> {}", oldStatus, newStatus);
        return saved;
    }

    @Transactional
    public PackageVersion manualFix(Long id, PackageStatus newStatus, String reason, String operator) {
        PackageVersion packageVersion = packageVersionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("包不存在: " + id));

        PackageStatus oldStatus = packageVersion.getStatus();
        packageVersion.setStatus(newStatus);
        packageVersion.setLastStatusChangeTime(LocalDateTime.now());
        packageVersion.setStatusChangeReason("[人工修正] " + reason);

        PackageVersion saved = packageVersionRepository.save(packageVersion);
        saveOperationLog("MANUAL_FIX", operator,
                packageVersion.getPackageName() + ":" + packageVersion.getVersion(),
                null, "人工状态修正: " + oldStatus + " -> " + newStatus + ", 原因: " + reason, true, null);

        log.info("人工修正包状态: {} -> {}, 原因: {}", oldStatus, newStatus, reason);
        return saved;
    }

    private void saveOperationLog(String operationType, String operator, String resourceKey,
                                  String rawInput, String conclusion, boolean success, String errorMsg) {
        OperationLog log = OperationLog.builder()
                .operationType(operationType)
                .operator(operator)
                .resourceKey(resourceKey)
                .rawInput(rawInput)
                .processingConclusion(conclusion)
                .success(success)
                .errorMessage(errorMsg)
                .build();
        operationLogRepository.save(log);
    }
}
