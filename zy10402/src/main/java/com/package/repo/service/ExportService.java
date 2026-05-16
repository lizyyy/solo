package com.package.repo.service;

import com.package.repo.model.entity.ImpactReport;
import com.package.repo.model.entity.PackageVersion;
import com.package.repo.model.entity.WithdrawRequest;
import com.package.repo.repository.ImpactReportRepository;
import com.package.repo.repository.PackageVersionRepository;
import com.package.repo.repository.WithdrawRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExportService {

    private final PackageVersionRepository packageVersionRepository;
    private final WithdrawRequestRepository withdrawRequestRepository;
    private final ImpactReportRepository impactReportRepository;

    public String exportPackagesToCsv() {
        List<PackageVersion> packages = packageVersionRepository.findAllActive();

        StringBuilder csv = new StringBuilder();
        csv.append("包名,版本,发布人,状态,发布时间,最后状态变更,描述\n");

        for (PackageVersion pkg : packages) {
            csv.append(escapeCsv(pkg.getPackageName())).append(",");
            csv.append(escapeCsv(pkg.getVersion())).append(",");
            csv.append(escapeCsv(pkg.getPublisher())).append(",");
            csv.append(escapeCsv(pkg.getStatus().getDescription())).append(",");
            csv.append(pkg.getPublishTime()).append(",");
            csv.append(pkg.getLastStatusChangeTime()).append(",");
            csv.append(escapeCsv(pkg.getDescription() != null ? pkg.getDescription() : "")).append("\n");
        }

        return csv.toString();
    }

    public String exportWithdrawRequestsToCsv() {
        List<WithdrawRequest> requests = withdrawRequestRepository.findAllOrderByRequestTimeDesc();

        StringBuilder csv = new StringBuilder();
        csv.append("请求ID,包名,版本,申请人,申请时间,仲裁状态,仲裁人,仲裁时间,处理结论\n");

        for (WithdrawRequest req : requests) {
            csv.append(escapeCsv(req.getRequestId())).append(",");
            csv.append(escapeCsv(req.getPackageVersion().getPackageName())).append(",");
            csv.append(escapeCsv(req.getPackageVersion().getVersion())).append(",");
            csv.append(escapeCsv(req.getRequester())).append(",");
            csv.append(req.getRequestTime()).append(",");
            csv.append(escapeCsv(req.getArbitrationResult().getDescription())).append(",");
            csv.append(escapeCsv(req.getArbitrator() != null ? req.getArbitrator() : "")).append(",");
            csv.append(req.getArbitrationTime() != null ? req.getArbitrationTime() : "").append(",");
            csv.append(escapeCsv(req.getProcessingConclusion() != null ? req.getProcessingConclusion() : "")).append("\n");
        }

        return csv.toString();
    }

    public String exportImpactReportsToCsv(String requestId) {
        List<ImpactReport> reports = impactReportRepository
                .findByWithdrawRequestRequestIdOrderByImpactLevelDesc(requestId);

        StringBuilder csv = new StringBuilder();
        csv.append("请求ID,影响项目,项目负责人,影响级别,需补偿,影响描述,补偿建议,生成时间\n");

        for (ImpactReport report : reports) {
            csv.append(escapeCsv(requestId)).append(",");
            csv.append(escapeCsv(report.getAffectedProject())).append(",");
            csv.append(escapeCsv(report.getProjectOwner() != null ? report.getProjectOwner() : "")).append(",");
            csv.append(report.getImpactLevel()).append(",");
            csv.append(report.getRequiresCompensation()).append(",");
            csv.append(escapeCsv(report.getImpactDescription() != null ? report.getImpactDescription() : "")).append(",");
            csv.append(escapeCsv(report.getCompensationSuggestion() != null ? report.getCompensationSuggestion() : "")).append(",");
            csv.append(report.getGeneratedTime()).append("\n");
        }

        return csv.toString();
    }

    public Map<String, Object> getImpactAnalysis(String packageName, String version) {
        PackageVersion pkg = packageVersionRepository
                .findByPackageNameAndVersionAndDeletedFalse(packageName, version)
                .orElseThrow(() -> new IllegalArgumentException("包不存在: " + packageName + ":" + version));

        List<WithdrawRequest> requests = withdrawRequestRepository
                .findByPackageNameAndVersion(packageName, version);

        Map<String, Object> analysis = new HashMap<>();
        analysis.put("packageName", packageName);
        analysis.put("version", version);
        analysis.put("currentStatus", pkg.getStatus());
        analysis.put("currentStatusDesc", pkg.getStatus().getDescription());
        analysis.put("dependencyCount", pkg.getDependencyProjects().size());
        analysis.put("withdrawRequestCount", requests.size());

        List<String> dependencies = pkg.getDependencyProjects().stream()
                .map(dep -> dep.getProjectName() + " (" +
                        (dep.getProjectOwner() != null ? dep.getProjectOwner() : "未知") + ")")
                .toList();
        analysis.put("dependencies", dependencies);

        if (!requests.isEmpty()) {
            WithdrawRequest latest = requests.get(0);
            analysis.put("latestWithdrawRequest", Map.of(
                    "requestId", latest.getRequestId(),
                    "requester", latest.getRequester(),
                    "status", latest.getArbitrationResult(),
                    "statusDesc", latest.getArbitrationResult().getDescription(),
                    "requestTime", latest.getRequestTime(),
                    "reason", latest.getReason()
            ));
        }

        return analysis;
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
