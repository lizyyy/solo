package com.dependency.license.service;

import com.dependency.license.dto.CreatePackageRequest;
import com.dependency.license.exception.BusinessException;
import com.dependency.license.model.DependencyPackage;
import com.dependency.license.repository.DependencyPackageRepository;
import com.dependency.license.util.SemanticVersionValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PackageService {
    private final DependencyPackageRepository packageRepository;
    private final SemanticVersionValidator versionValidator;
    private final AuditService auditService;

    @Transactional
    public DependencyPackage createPackage(CreatePackageRequest request) {
        versionValidator.validate(request.getCurrentVersion());
        versionValidator.validate(request.getTargetVersion());

        if (!versionValidator.isUpgrade(request.getCurrentVersion(), request.getTargetVersion())) {
            throw new BusinessException(400, "目标版本必须高于当前版本", request.toString());
        }

        Optional<DependencyPackage> existing = packageRepository
                .findByGroupIdAndArtifactId(request.getGroupId(), request.getArtifactId());
        if (existing.isPresent()) {
            throw new BusinessException(409, "依赖包已存在: " + request.getGroupId() + ":" + request.getArtifactId());
        }

        DependencyPackage pkg = new DependencyPackage();
        pkg.setName(request.getName());
        pkg.setGroupId(request.getGroupId());
        pkg.setArtifactId(request.getArtifactId());
        pkg.setCurrentVersion(request.getCurrentVersion());
        pkg.setTargetVersion(request.getTargetVersion());
        pkg.setDescription(request.getDescription());
        pkg.setChangeLog(request.getChangeLog());
        pkg.setCategory(request.getCategory());

        DependencyPackage saved = packageRepository.save(pkg);
        auditService.logSuccess("CREATE_PACKAGE", "DependencyPackage", saved.getId(), request, saved);
        return saved;
    }

    public List<DependencyPackage> getAllPackages() {
        return packageRepository.findAll();
    }

    public DependencyPackage getPackageById(Long id) {
        return packageRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "依赖包不存在: " + id));
    }

    @Transactional
    public DependencyPackage updatePackage(Long id, CreatePackageRequest request) {
        DependencyPackage pkg = getPackageById(id);

        versionValidator.validate(request.getCurrentVersion());
        versionValidator.validate(request.getTargetVersion());

        pkg.setName(request.getName());
        pkg.setCurrentVersion(request.getCurrentVersion());
        pkg.setTargetVersion(request.getTargetVersion());
        pkg.setDescription(request.getDescription());
        pkg.setChangeLog(request.getChangeLog());
        pkg.setCategory(request.getCategory());

        DependencyPackage saved = packageRepository.save(pkg);
        auditService.logSuccess("UPDATE_PACKAGE", "DependencyPackage", id, request, saved);
        return saved;
    }
}