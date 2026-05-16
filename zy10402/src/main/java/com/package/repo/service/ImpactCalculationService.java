package com.package.repo.service;

import com.package.repo.model.entity.DependencyProject;
import com.package.repo.model.entity.ImpactReport;
import com.package.repo.model.entity.WithdrawRequest;
import com.package.repo.repository.DependencyProjectRepository;
import com.package.repo.repository.ImpactReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImpactCalculationService {

    private final DependencyProjectRepository dependencyProjectRepository;
    private final ImpactReportRepository impactReportRepository;

    @Transactional
    public List<ImpactReport> calculateAndSaveImpact(WithdrawRequest withdrawRequest) {
        String packageName = withdrawRequest.getPackageVersion().getPackageName();
        String version = withdrawRequest.getPackageVersion().getVersion();

        List<DependencyProject> dependencies = dependencyProjectRepository
                .findActiveByPackageNameAndVersion(packageName, version);

        List<ImpactReport> reports = new ArrayList<>();

        for (DependencyProject dep : dependencies) {
            ImpactReport report = generateImpactReport(withdrawRequest, dep);
            reports.add(report);
        }

        return impactReportRepository.saveAll(reports);
    }

    private ImpactReport generateImpactReport(WithdrawRequest withdrawRequest, DependencyProject dep) {
        int impactLevel = calculateImpactLevel(dep);
        boolean requiresCompensation = impactLevel >= 3;

        return ImpactReport.builder()
                .withdrawRequest(withdrawRequest)
                .affectedProject(dep.getProjectName())
                .projectOwner(dep.getProjectOwner())
                .impactDescription(generateImpactDescription(dep, impactLevel))
                .impactLevel(impactLevel)
                .requiresCompensation(requiresCompensation)
                .compensationSuggestion(requiresCompensation ? generateCompensationSuggestion(dep) : null)
                .build();
    }

    private int calculateImpactLevel(DependencyProject dep) {
        int level = 1;
        String projectName = dep.getProjectName().toLowerCase();

        if (projectName.contains("core") || projectName.contains("framework")) {
            level += 2;
        }
        if (projectName.contains("payment") || projectName.contains("order")) {
            level += 2;
        }
        if (dep.getProjectOwner() == null || dep.getProjectOwner().isEmpty()) {
            level += 1;
        }
        if (dep.getUsageDescription() != null && dep.getUsageDescription().contains("critical")) {
            level += 1;
        }

        return Math.min(level, 5);
    }

    private String generateImpactDescription(DependencyProject dep, int impactLevel) {
        return String.format("项目 [%s] 依赖该包，影响级别 %d级，使用场景：%s",
                dep.getProjectName(),
                impactLevel,
                dep.getUsageDescription() != null ? dep.getUsageDescription() : "未指定");
    }

    private String generateCompensationSuggestion(DependencyProject dep) {
        return String.format("建议联系项目负责人 [%s]，提供版本回退方案或临时修复补丁。",
                dep.getProjectOwner() != null ? dep.getProjectOwner() : "未知");
    }

    public boolean hasHighImpactDependencies(String packageName, String version) {
        int dependencyCount = dependencyProjectRepository.countActiveDependencies(packageName, version);
        return dependencyCount >= 3;
    }

    public List<ImpactReport> getImpactReportsForRequest(String requestId) {
        return impactReportRepository.findByWithdrawRequestRequestIdOrderByImpactLevelDesc(requestId);
    }
}
