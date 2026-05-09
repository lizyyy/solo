package com.grayscale.rollback.service;

import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.repository.ReleaseRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class RecoveryService {
    
    private final ReleaseRepository releaseRepository;
    private final ReleaseService releaseService;
    private final OperationLogService logService;
    private final ErrorReplayService replayService;
    
    public RecoveryService(ReleaseRepository releaseRepository,
                         ReleaseService releaseService,
                         OperationLogService logService,
                         ErrorReplayService replayService) {
        this.releaseRepository = releaseRepository;
        this.releaseService = releaseService;
        this.logService = logService;
        this.replayService = replayService;
    }
    
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void recoverStuckReleases() {
        log.info("Running recovery check for stuck releases");
        
        List<ReleaseStatus> stuckStatuses = List.of(
            ReleaseStatus.ROLLBACKING
        );
        
        List<Release> stuckReleases = releaseRepository.findByStatusIn(stuckStatuses);
        
        for (Release release : stuckReleases) {
            try {
                recoverRelease(release);
            } catch (Exception e) {
                log.error("Failed to recover release {}: {}", release.getId(), e.getMessage());
            }
        }
    }
    
    @Transactional
    public void recoverRelease(Release release) {
        log.info("Attempting to recover release: {}", release.getId());
        
        switch (release.getStatus()) {
            case ROLLBACKING -> {
                try {
                    releaseService.executeRollback(release.getId());
                    log.info("Successfully recovered release {} from ROLLBACKING to ROLLED_BACK", release.getId());
                } catch (Exception e) {
                    log.warn("Recovery failed, marking release {} as FAILED: {}", release.getId(), e.getMessage());
                    releaseService.failRelease(release.getId(), "Recovery failed: " + e.getMessage());
                }
            }
            default -> log.warn("No recovery strategy for status: {}", release.getStatus());
        }
    }
    
    @Transactional
    public Release forceRecovery(String releaseId, String operator) {
        Release release = releaseRepository.findById(releaseId)
            .orElseThrow(() -> new IllegalArgumentException("Release not found: " + releaseId));
        
        log.info("Forcing recovery for release: {} by operator: {}", releaseId, operator);
        
        if (release.getStatus() == ReleaseStatus.ROLLBACKING) {
            try {
                return releaseService.executeRollback(releaseId);
            } catch (Exception e) {
                return releaseService.failRelease(releaseId, 
                    "Force recovery failed: " + e.getMessage());
            }
        }
        
        if (release.getStatus() == ReleaseStatus.FAILED) {
            var failedOps = replayService.getFailedOperations(releaseId);
            if (!failedOps.isEmpty()) {
                var results = replayService.replayAllFailedOperations(releaseId, operator);
                if (!results.isEmpty()) {
                    return results.get(results.size() - 1);
                }
            }
        }
        
        throw new IllegalStateException("Cannot recover release with status: " + release.getStatus());
    }
}
