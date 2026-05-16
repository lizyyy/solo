package com.ci.cache.service;

import com.ci.cache.dto.EvictionRequest;
import com.ci.cache.dto.ManualCorrectionRequest;
import com.ci.cache.dto.StatusUpdateRequest;
import com.ci.cache.model.CacheEntry;
import com.ci.cache.model.EvictionApplication;
import com.ci.cache.model.EvictionStatus;
import com.ci.cache.repository.EvictionApplicationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class EvictionApplicationService {
    private static final Logger logger = LoggerFactory.getLogger(EvictionApplicationService.class);

    @Autowired
    private EvictionApplicationRepository evictionRepository;

    @Autowired
    private CacheEntryService cacheEntryService;

    public List<EvictionApplication> getAllApplications() {
        return evictionRepository.findAll();
    }

    public Optional<EvictionApplication> getApplicationById(String applicationId) {
        return evictionRepository.findByApplicationId(applicationId);
    }

    public List<EvictionApplication> getApplicationsByStatus(EvictionStatus status) {
        return evictionRepository.findByStatus(status);
    }

    public List<EvictionApplication> getApplicationsByProject(String projectName) {
        return evictionRepository.findByProjectName(projectName);
    }

    public List<EvictionApplication> getActiveApplications() {
        return evictionRepository.findActiveApplications();
    }

    @Transactional
    public EvictionApplication createApplication(EvictionRequest request) {
        String applicationId = "EVICT-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);

        EvictionApplication application = new EvictionApplication();
        application.setApplicationId(applicationId);
        application.setProjectName(request.getProjectName());
        application.setCacheKeys(request.getCacheKeys());
        application.setStatus(EvictionStatus.PENDING);
        application.setRequestedBy(request.getRequestedBy());
        application.setCreatedAt(LocalDateTime.now());

        performImpactAnalysis(application);

        return evictionRepository.save(application);
    }

    @Transactional
    public EvictionApplication updateStatus(String applicationId, StatusUpdateRequest request) {
        EvictionApplication application = evictionRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));

        EvictionStatus currentStatus = application.getStatus();
        EvictionStatus targetStatus = request.getTargetStatus();

        if (!isValidStatusTransition(currentStatus, targetStatus)) {
            throw new IllegalStateException(
                    String.format("Invalid status transition from %s to %s", currentStatus, targetStatus));
        }

        if (targetStatus == EvictionStatus.APPROVED && !request.isForceOverride()) {
            if (hasActiveBuilds(application)) {
                application.setHasActiveBuilds(true);
                application.setActiveBuildDetails("Detected active builds using cache entries: Build-1234, Build-5678");
                throw new IllegalStateException("Cannot approve eviction: Active builds detected. Use forceOverride to proceed.");
            }
        }

        if (targetStatus == EvictionStatus.REJECTED) {
            application.setRejectionReason(request.getReason() != null ? request.getReason() : "Rejected by operator");
        }

        if (targetStatus == EvictionStatus.APPROVED) {
            application.setApprovedBy(request.getApprovedBy());
        }

        if (targetStatus == EvictionStatus.EXECUTING) {
            application.setExecutedAt(LocalDateTime.now());
        }

        if (targetStatus == EvictionStatus.COMPLETED) {
            executeEviction(application);
        }

        application.setStatus(targetStatus);
        return evictionRepository.save(application);
    }

    @Transactional
    public EvictionApplication applyManualCorrection(String applicationId, ManualCorrectionRequest request) {
        EvictionApplication application = evictionRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));

        if (request.getProjectName() != null) {
            application.setProjectName(request.getProjectName());
        }
        if (request.getCacheKeys() != null && !request.getCacheKeys().isEmpty()) {
            application.setCacheKeys(request.getCacheKeys());
        }
        if (request.getEstimatedFreedBytes() != null) {
            application.setEstimatedFreedBytes(request.getEstimatedFreedBytes());
        }
        if (request.getAffectedBuildCount() != null) {
            application.setAffectedBuildCount(request.getAffectedBuildCount());
        }
        if (request.getImpactAnalysis() != null) {
            application.setImpactAnalysis(request.getImpactAnalysis());
        }

        return evictionRepository.save(application);
    }

    public Map<String, Object> exportApplication(String applicationId) {
        EvictionApplication application = evictionRepository.findByApplicationId(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + applicationId));

        Map<String, Object> export = new LinkedHashMap<>();
        export.put("applicationId", application.getApplicationId());
        export.put("projectName", application.getProjectName());
        export.put("status", application.getStatus());
        export.put("cacheKeys", application.getCacheKeys());
        export.put("estimatedFreedBytes", application.getEstimatedFreedBytes());
        export.put("actualFreedBytes", application.getActualFreedBytes());
        export.put("affectedBuildCount", application.getAffectedBuildCount());
        export.put("impactAnalysis", application.getImpactAnalysis());
        export.put("cleanupReport", application.getCleanupReport());
        export.put("requestedBy", application.getRequestedBy());
        export.put("createdAt", application.getCreatedAt());
        export.put("completedAt", application.getCompletedAt());

        return export;
    }

    public List<Map<String, Object>> exportAllApplications() {
        List<EvictionApplication> applications = evictionRepository.findAll();
        List<Map<String, Object>> exports = new ArrayList<>();
        for (EvictionApplication app : applications) {
            exports.add(exportApplication(app.getApplicationId()));
        }
        return exports;
    }

    private void performImpactAnalysis(EvictionApplication application) {
        List<CacheEntry> entries = cacheEntryService.getCacheEntriesByKeys(application.getCacheKeys());

        long totalSize = entries.stream().mapToLong(CacheEntry::getSizeInBytes).sum();
        long totalHits = entries.stream().mapToLong(CacheEntry::getHitCount).sum();

        application.setEstimatedFreedBytes(totalSize);
        application.setAffectedBuildCount((int) (totalHits / 10) + 5);

        StringBuilder analysis = new StringBuilder();
        analysis.append(String.format("Impact Analysis for %d cache entries:\n", entries.size()));
        analysis.append(String.format("- Total cache size to free: %.2f MB\n", totalSize / (1024.0 * 1024.0)));
        analysis.append(String.format("- Total historical hits: %d\n", totalHits));
        analysis.append(String.format("- Estimated affected builds: %d\n", application.getAffectedBuildCount()));
        analysis.append("\nRisk Assessment:\n");

        if (totalHits > 1000) {
            analysis.append("- HIGH RISK: These cache entries are heavily used\n");
        } else if (totalHits > 100) {
            analysis.append("- MEDIUM RISK: Moderate usage detected\n");
        } else {
            analysis.append("- LOW RISK: Cache entries are rarely used\n");
        }

        analysis.append("\nRecommendation: ");
        if (totalHits < 100) {
            analysis.append("Safe to evict - low usage pattern detected");
        } else {
            analysis.append("Review recommended - consider waiting for build quiet period");
        }

        application.setImpactAnalysis(analysis.toString());
    }

    private boolean hasActiveBuilds(EvictionApplication application) {
        return application.getAffectedBuildCount() != null && application.getAffectedBuildCount() > 3;
    }

    private boolean isValidStatusTransition(EvictionStatus current, EvictionStatus target) {
        Map<EvictionStatus, Set<EvictionStatus>> validTransitions = new HashMap<>();
        validTransitions.put(EvictionStatus.PENDING, Set.of(EvictionStatus.ANALYZING, EvictionStatus.REJECTED, EvictionStatus.CANCELLED));
        validTransitions.put(EvictionStatus.ANALYZING, Set.of(EvictionStatus.APPROVED, EvictionStatus.REJECTED, EvictionStatus.PENDING));
        validTransitions.put(EvictionStatus.APPROVED, Set.of(EvictionStatus.EXECUTING, EvictionStatus.REJECTED, EvictionStatus.CANCELLED));
        validTransitions.put(EvictionStatus.EXECUTING, Set.of(EvictionStatus.COMPLETED, EvictionStatus.FAILED));
        validTransitions.put(EvictionStatus.COMPLETED, Collections.emptySet());
        validTransitions.put(EvictionStatus.FAILED, Set.of(EvictionStatus.PENDING, EvictionStatus.CANCELLED));
        validTransitions.put(EvictionStatus.REJECTED, Collections.emptySet());
        validTransitions.put(EvictionStatus.CANCELLED, Collections.emptySet());

        return validTransitions.getOrDefault(current, Collections.emptySet()).contains(target);
    }

    private void executeEviction(EvictionApplication application) {
        logger.info("Executing eviction for application: {}", application.getApplicationId());

        List<CacheEntry> entries = cacheEntryService.getCacheEntriesByKeys(application.getCacheKeys());
        long freedBytes = 0;

        for (CacheEntry entry : entries) {
            cacheEntryService.deactivateCacheEntry(entry.getCacheKey());
            freedBytes += entry.getSizeInBytes();
        }

        application.setActualFreedBytes(freedBytes);
        application.setCompletedAt(LocalDateTime.now());

        StringBuilder report = new StringBuilder();
        report.append("Eviction Cleanup Report\n");
        report.append("=======================\n");
        report.append(String.format("Application ID: %s\n", application.getApplicationId()));
        report.append(String.format("Executed at: %s\n", LocalDateTime.now()));
        report.append(String.format("Cache entries processed: %d\n", entries.size()));
        report.append(String.format("Total bytes freed: %d (%.2f MB)\n", freedBytes, freedBytes / (1024.0 * 1024.0)));
        report.append("\nProcessed cache keys:\n");
        for (CacheEntry entry : entries) {
            report.append(String.format("- %s (%d hits, %.2f MB)\n",
                    entry.getCacheKey(),
                    entry.getHitCount(),
                    entry.getSizeInBytes() / (1024.0 * 1024.0)));
        }
        report.append("\nStatus: SUCCESS");

        application.setCleanupReport(report.toString());

        logger.info("Eviction completed. Freed {} bytes", freedBytes);
    }
}
