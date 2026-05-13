package com.example.readonlywindow.service;

import com.example.readonlywindow.dto.WindowSummaryDTO;
import com.example.readonlywindow.entity.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {
    private final FreezeWindowService windowService;
    private final WriteRequestService requestService;
    private final ReleaseCredentialService credentialService;
    private final ConflictService conflictService;
    private final TimelineService timelineService;

    public WindowSummaryDTO exportWindowSummary(String windowCode) {
        FreezeWindow window = windowService.getWindowByCode(windowCode);
        List<WriteRequest> requests = requestService.getRequestsByWindow(windowCode);
        List<ReleaseCredential> credentials = credentialService.getCredentialsByWindow(windowCode);
        List<ConflictRecord> conflicts = conflictService.getConflictsByWindow(windowCode);
        List<TimelineEvent> timeline = timelineService.getWindowTimeline(window.getId());

        WindowSummaryDTO summary = new WindowSummaryDTO();
        summary.setWindowCode(window.getWindowCode());
        summary.setWindowName(window.getName());
        summary.setStatus(window.getStatus());
        summary.setStartTime(window.getStartTime());
        summary.setEndTime(window.getEndTime());
        summary.setCreatedBy(window.getCreatedBy());
        summary.setCreatedAt(window.getCreatedAt());
        summary.setResourceScopes(window.getResourceScopes());
        summary.setTotalRequests(requests.size());
        summary.setPendingRequests((int) requests.stream().filter(r -> r.getStatus() == RequestStatus.PENDING).count());
        summary.setApprovedRequests((int) requests.stream().filter(r -> r.getStatus() == RequestStatus.APPROVED).count());
        summary.setRejectedRequests((int) requests.stream().filter(r -> r.getStatus() == RequestStatus.REJECTED).count());
        summary.setTotalCredentials(credentials.size());
        summary.setUsedCredentials((int) credentials.stream().filter(ReleaseCredential::isUsed).count());
        summary.setTotalConflicts(conflicts.size());
        summary.setUnresolvedConflicts((int) conflicts.stream().filter(c -> !c.isResolved()).count());
        summary.setTimelineEvents(timeline);
        summary.setGeneratedAt(LocalDateTime.now());

        return summary;
    }

    public Map<String, Object> exportFullAuditReport() {
        Map<String, Object> report = new HashMap<>();
        List<FreezeWindow> windows = windowService.getAllWindows();
        List<WriteRequest> requests = requestService.getAllRequests();
        List<ReleaseCredential> credentials = credentialService.getAllCredentials();
        List<ConflictRecord> conflicts = conflictService.getAllConflicts();

        report.put("generatedAt", LocalDateTime.now());
        report.put("totalWindows", windows.size());
        report.put("totalRequests", requests.size());
        report.put("totalCredentials", credentials.size());
        report.put("totalConflicts", conflicts.size());

        Map<String, Long> windowStatusCount = new HashMap<>();
        for (WindowStatus status : WindowStatus.values()) {
            windowStatusCount.put(status.name(), windows.stream().filter(w -> w.getStatus() == status).count());
        }
        report.put("windowStatusDistribution", windowStatusCount);

        Map<String, Long> requestStatusCount = new HashMap<>();
        for (RequestStatus status : RequestStatus.values()) {
            requestStatusCount.put(status.name(), requests.stream().filter(r -> r.getStatus() == status).count());
        }
        report.put("requestStatusDistribution", requestStatusCount);

        report.put("windows", windows);
        report.put("requests", requests);
        report.put("credentials", credentials);
        report.put("conflicts", conflicts);

        return report;
    }
}
