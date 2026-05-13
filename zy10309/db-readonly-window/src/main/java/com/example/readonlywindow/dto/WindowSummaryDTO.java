package com.example.readonlywindow.dto;

import com.example.readonlywindow.entity.ResourceScope;
import com.example.readonlywindow.entity.TimelineEvent;
import com.example.readonlywindow.entity.WindowStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class WindowSummaryDTO {
    private String windowCode;
    private String windowName;
    private WindowStatus status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String createdBy;
    private LocalDateTime createdAt;
    private List<ResourceScope> resourceScopes;
    private int totalRequests;
    private int pendingRequests;
    private int approvedRequests;
    private int rejectedRequests;
    private int totalCredentials;
    private int usedCredentials;
    private int totalConflicts;
    private int unresolvedConflicts;
    private List<TimelineEvent> timelineEvents;
    private LocalDateTime generatedAt;
}
