package com.mold.service.service;

import com.mold.service.domain.entity.*;
import com.mold.service.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {
    
    private final MoldRepository moldRepository;
    private final MoldChangeTaskRepository taskRepository;
    private final MoldExtensionApprovalRepository approvalRepository;
    private final ProductionScheduleRepository scheduleRepository;
    private final StrokeRecordRepository strokeRecordRepository;
    
    @Transactional(readOnly = true)
    public MoldLifeSummary getMoldLifeSummary() {
        List<Mold> allMolds = moldRepository.findAll();
        
        Map<Mold.MoldStatus, List<Mold>> statusGroups = allMolds.stream()
                .collect(Collectors.groupingBy(Mold::getStatus));
        
        long normalCount = countByStatus(statusGroups, Mold.MoldStatus.IN_USE, Mold.MoldStatus.AVAILABLE);
        long warningCount = countByStatus(statusGroups, Mold.MoldStatus.WARNING);
        long expiredCount = countByStatus(statusGroups, Mold.MoldStatus.EXPIRED);
        long maintenanceCount = countByStatus(statusGroups, Mold.MoldStatus.UNDER_MAINTENANCE);
        
        List<MoldLifeSummary.WarningMoldDetail> warningDetails = new ArrayList<>();
        List<MoldLifeSummary.ExpiredMoldDetail> expiredDetails = new ArrayList<>();
        
        for (Mold mold : allMolds) {
            if (mold.getStatus() == Mold.MoldStatus.WARNING) {
                warningDetails.add(toWarningDetail(mold));
            } else if (mold.getStatus() == Mold.MoldStatus.EXPIRED) {
                expiredDetails.add(toExpiredDetail(mold));
            }
        }
        
        warningDetails.sort(Comparator.comparingDouble(MoldLifeSummary.WarningMoldDetail::getLifePercentage).reversed());
        expiredDetails.sort(Comparator.comparingDouble(MoldLifeSummary.ExpiredMoldDetail::getOverPercentage).reversed());
        
        long pendingTasks = taskRepository.countPendingTasks();
        long pendingApprovals = approvalRepository.countPendingApprovals();
        
        List<MoldChangeTask> activeTasks = taskRepository.findByStatusIn(
                Arrays.asList(MoldChangeTask.TaskStatus.PENDING, MoldChangeTask.TaskStatus.ASSIGNED, MoldChangeTask.TaskStatus.IN_PROGRESS)
        );
        
        Map<String, Long> taskTypeCount = activeTasks.stream()
                .collect(Collectors.groupingBy(t -> t.getTaskType().name(), Collectors.counting()));
        
        Map<MoldChangeTask.TaskPriority, Long> priorityCount = activeTasks.stream()
                .collect(Collectors.groupingBy(MoldChangeTask::getPriority, Collectors.counting()));
        
        MoldLifeSummary summary = new MoldLifeSummary();
        summary.setTotalMolds(allMolds.size());
        summary.setNormalCount(normalCount);
        summary.setWarningCount(warningCount);
        summary.setExpiredCount(expiredCount);
        summary.setMaintenanceCount(maintenanceCount);
        summary.setPendingTaskCount(pendingTasks);
        summary.setPendingApprovalCount(pendingApprovals);
        summary.setWarningMolds(warningDetails);
        summary.setExpiredMolds(expiredDetails);
        summary.setActiveTaskTypeCount(taskTypeCount);
        summary.setPriorityCount(priorityCount);
        summary.setSummaryTime(LocalDateTime.now());
        
        return summary;
    }
    
    @Transactional(readOnly = true)
    public ScheduleImpactReport getScheduleImpactReport() {
        List<ProductionSchedule> activeSchedules = scheduleRepository.findByStatusIn(
                Arrays.asList(
                        ProductionSchedule.ScheduleStatus.PLANNED,
                        ProductionSchedule.ScheduleStatus.READY,
                        ProductionSchedule.ScheduleStatus.IN_PROGRESS
                )
        );
        
        Map<ProductionSchedule.ImpactStatus, List<ProductionSchedule>> impactGroups = activeSchedules.stream()
                .filter(s -> s.getMoldImpactStatus() != null)
                .collect(Collectors.groupingBy(ProductionSchedule::getMoldImpactStatus));
        
        Map<String, List<ScheduleImpactReport.ScheduleImpactDetail>> lineGroups = activeSchedules.stream()
                .collect(Collectors.groupingBy(ProductionSchedule::getProductionLine));
        
        List<ScheduleImpactReport.LineImpactSummary> lineSummaries = new ArrayList<>();
        
        for (Map.Entry<String, List<ScheduleImpactReport.ScheduleImpactDetail>> entry : lineGroups.entrySet()) {
            ScheduleImpactReport.LineImpactSummary lineSummary = new ScheduleImpactReport.LineImpactSummary();
            lineSummary.setProductionLine(entry.getKey());
            lineSummary.setTotalSchedules(entry.getValue().size());
            
            long normalCount = entry.getValue().stream()
                    .filter(s -> s.getMoldImpactStatus() == ProductionSchedule.ImpactStatus.NORMAL)
                    .count();
            long warningCount = entry.getValue().stream()
                    .filter(s -> s.getMoldImpactStatus() == ProductionSchedule.ImpactStatus.WARNING)
                    .count();
            long atRiskCount = entry.getValue().stream()
                    .filter(s -> s.getMoldImpactStatus() == ProductionSchedule.ImpactStatus.AT_RISK)
                    .count();
            long needChangeCount = entry.getValue().stream()
                    .filter(s -> s.getMoldImpactStatus() == ProductionSchedule.ImpactStatus.NEEDS_MOLD_CHANGE)
                    .count();
            
            lineSummary.setNormalCount(normalCount);
            lineSummary.setWarningCount(warningCount);
            lineSummary.setAtRiskCount(atRiskCount);
            lineSummary.setNeedChangeCount(needChangeCount);
            lineSummary.setDetails(entry.getValue());
            lineSummaries.add(lineSummary);
        }
        
        ScheduleImpactReport report = new ScheduleImpactReport();
        report.setTotalActiveSchedules(activeSchedules.size());
        report.setNormalCount(impactGroups.getOrDefault(ProductionSchedule.ImpactStatus.NORMAL, Collections.emptyList()).size());
        report.setWarningCount(impactGroups.getOrDefault(ProductionSchedule.ImpactStatus.WARNING, Collections.emptyList()).size());
        report.setAtRiskCount(impactGroups.getOrDefault(ProductionSchedule.ImpactStatus.AT_RISK, Collections.emptyList()).size());
        report.setNeedChangeCount(impactGroups.getOrDefault(ProductionSchedule.ImpactStatus.NEEDS_MOLD_CHANGE, Collections.emptyList()).size());
        report.setLineSummaries(lineSummaries);
        report.setReportTime(LocalDateTime.now());
        
        return report;
    }
    
    @Transactional(readOnly = true)
    public HistoryTraceReport getHistoryTraceReport(String moldCode) {
        Mold mold = moldRepository.findByMoldCode(moldCode).orElse(null);
        if (mold == null) {
            return null;
        }
        
        List<StrokeRecord> strokeRecords = strokeRecordRepository.findByMoldIdAndStatus(
                mold.getId(), StrokeRecord.RecordStatus.ACTIVE
        );
        
        List<MoldChangeTask> tasks = taskRepository.findByMoldIdOrderByCreatedAtDesc(mold.getId());
        
        List<MoldExtensionApproval> approvals = approvalRepository.findByMoldIdOrderByCreatedAtDesc(mold.getId());
        
        List<HistoryTraceReport.HistoryEvent> events = new ArrayList<>();
        
        for (StrokeRecord record : strokeRecords) {
            HistoryTraceReport.HistoryEvent event = new HistoryTraceReport.HistoryEvent();
            event.setEventType("STROKE_RECORD");
            event.setEventTime(record.getRecordTime());
            event.setDescription(String.format("冲压记录: %d次, 累计: %d次", 
                    record.getStrokeCount(), record.getAccumulatedStrokes()));
            event.setSource(record.getSource().name());
            event.setOperator(record.getOperator());
            events.add(event);
        }
        
        for (MoldChangeTask task : tasks) {
            HistoryTraceReport.HistoryEvent event = new HistoryTraceReport.HistoryEvent();
            event.setEventType("MOLD_CHANGE_TASK");
            event.setEventTime(task.getCreatedAt());
            event.setDescription(String.format("换模任务: %s, 类型: %s, 状态: %s", 
                    task.getTaskNo(), task.getTaskType(), task.getStatus()));
            event.setSource("SYSTEM");
            event.setOperator(task.getCreatedBy());
            events.add(event);
        }
        
        for (MoldExtensionApproval approval : approvals) {
            HistoryTraceReport.HistoryEvent event = new HistoryTraceReport.HistoryEvent();
            event.setEventType("EXTENSION_APPROVAL");
            event.setEventTime(approval.getCreatedAt());
            event.setDescription(String.format("续用审批: %s, 续用次数: %d, 状态: %s", 
                    approval.getApprovalNo(), approval.getExtensionStrokes(), approval.getStatus()));
            event.setSource(approval.getStatus() == MoldExtensionApproval.ApprovalStatus.APPROVED ? "APPROVED" : "REQUEST");
            event.setOperator(approval.getRequester());
            events.add(event);
        }
        
        events.sort(Comparator.comparing(HistoryTraceReport.HistoryEvent::getEventTime).reversed());
        
        HistoryTraceReport report = new HistoryTraceReport();
        report.setMoldId(mold.getId());
        report.setMoldCode(mold.getMoldCode());
        report.setMoldName(mold.getMoldName());
        report.setCurrentStatus(mold.getStatus().name());
        report.setCurrentStrokes(mold.getTotalStrokes());
        report.setLifeThreshold(mold.getLifeThreshold());
        report.setWarningThreshold(mold.getWarningThreshold());
        report.setLifePercentage(calculatePercentage(mold.getTotalStrokes(), mold.getLifeThreshold()));
        report.setEvents(events);
        report.setReportTime(LocalDateTime.now());
        
        return report;
    }
    
    private long countByStatus(Map<Mold.MoldStatus, List<Mold>> groups, Mold.MoldStatus... statuses) {
        return Arrays.stream(statuses)
                .mapToLong(s -> groups.getOrDefault(s, Collections.emptyList()).size())
                .sum();
    }
    
    private MoldLifeSummary.WarningMoldDetail toWarningDetail(Mold mold) {
        MoldLifeSummary.WarningMoldDetail detail = new MoldLifeSummary.WarningMoldDetail();
        detail.setMoldId(mold.getId());
        detail.setMoldCode(mold.getMoldCode());
        detail.setMoldName(mold.getMoldName());
        detail.setProductionLine(mold.getProductionLine());
        detail.setCurrentProduct(mold.getCurrentProduct());
        detail.setCurrentStrokes(mold.getTotalStrokes());
        detail.setWarningThreshold(mold.getWarningThreshold());
        detail.setLifeThreshold(mold.getLifeThreshold());
        detail.setRemainingStrokes(mold.getLifeThreshold() - mold.getTotalStrokes());
        detail.setLifePercentage(calculatePercentage(mold.getTotalStrokes(), mold.getLifeThreshold()));
        return detail;
    }
    
    private MoldLifeSummary.ExpiredMoldDetail toExpiredDetail(Mold mold) {
        MoldLifeSummary.ExpiredMoldDetail detail = new MoldLifeSummary.ExpiredMoldDetail();
        detail.setMoldId(mold.getId());
        detail.setMoldCode(mold.getMoldCode());
        detail.setMoldName(mold.getMoldName());
        detail.setProductionLine(mold.getProductionLine());
        detail.setCurrentProduct(mold.getCurrentProduct());
        detail.setCurrentStrokes(mold.getTotalStrokes());
        detail.setLifeThreshold(mold.getLifeThreshold());
        detail.setOverStrokes(mold.getTotalStrokes() - mold.getLifeThreshold());
        detail.setOverPercentage(calculatePercentage(detail.getOverStrokes(), mold.getLifeThreshold()));
        
        List<MoldChangeTask> activeTasks = taskRepository.findActiveTasksByMoldId(mold.getId());
        if (!activeTasks.isEmpty()) {
            MoldChangeTask task = activeTasks.get(0);
            detail.setTaskNo(task.getTaskNo());
            detail.setTaskStatus(task.getStatus().name());
            detail.setTaskPriority(task.getPriority().name());
            detail.setTaskCreatedAt(task.getCreatedAt());
        }
        
        return detail;
    }
    
    private double calculatePercentage(Long numerator, Long denominator) {
        if (denominator == null || denominator == 0) {
            return 0.0;
        }
        return (double) numerator / denominator * 100;
    }
    
    @Data
    public static class MoldLifeSummary {
        private long totalMolds;
        private long normalCount;
        private long warningCount;
        private long expiredCount;
        private long maintenanceCount;
        private long pendingTaskCount;
        private long pendingApprovalCount;
        private List<WarningMoldDetail> warningMolds;
        private List<ExpiredMoldDetail> expiredMolds;
        private Map<String, Long> activeTaskTypeCount;
        private Map<MoldChangeTask.TaskPriority, Long> priorityCount;
        private LocalDateTime summaryTime;
        
        @Data
        public static class WarningMoldDetail {
            private Long moldId;
            private String moldCode;
            private String moldName;
            private String productionLine;
            private String currentProduct;
            private Long currentStrokes;
            private Long warningThreshold;
            private Long lifeThreshold;
            private Long remainingStrokes;
            private double lifePercentage;
        }
        
        @Data
        public static class ExpiredMoldDetail {
            private Long moldId;
            private String moldCode;
            private String moldName;
            private String productionLine;
            private String currentProduct;
            private Long currentStrokes;
            private Long lifeThreshold;
            private Long overStrokes;
            private double overPercentage;
            private String taskNo;
            private String taskStatus;
            private String taskPriority;
            private LocalDateTime taskCreatedAt;
        }
    }
    
    @Data
    public static class ScheduleImpactReport {
        private long totalActiveSchedules;
        private long normalCount;
        private long warningCount;
        private long atRiskCount;
        private long needChangeCount;
        private List<LineImpactSummary> lineSummaries;
        private LocalDateTime reportTime;
        
        @Data
        public static class LineImpactSummary {
            private String productionLine;
            private long totalSchedules;
            private long normalCount;
            private long warningCount;
            private long atRiskCount;
            private long needChangeCount;
            private List<ScheduleImpactDetail> details;
        }
        
        @Data
        public static class ScheduleImpactDetail {
            private Long scheduleId;
            private String scheduleNo;
            private String productionLine;
            private String productCode;
            private Long moldId;
            private String moldCode;
            private ProductionSchedule.ScheduleStatus scheduleStatus;
            private ProductionSchedule.ImpactStatus moldImpactStatus;
            private String moldImpactDetail;
            private LocalDateTime plannedStartTime;
            private LocalDateTime plannedEndTime;
        }
    }
    
    @Data
    public static class HistoryTraceReport {
        private Long moldId;
        private String moldCode;
        private String moldName;
        private String currentStatus;
        private Long currentStrokes;
        private Long lifeThreshold;
        private Long warningThreshold;
        private double lifePercentage;
        private List<HistoryEvent> events;
        private LocalDateTime reportTime;
        
        @Data
        public static class HistoryEvent {
            private String eventType;
            private LocalDateTime eventTime;
            private String description;
            private String source;
            private String operator;
        }
    }
}
