package com.port.reefer.service;

import com.port.reefer.dto.AlarmHandleRequest;
import com.port.reefer.entity.AlarmRecord;
import com.port.reefer.entity.Inspector;
import com.port.reefer.entity.PluginReport;
import com.port.reefer.entity.enums.AlarmStatus;
import com.port.reefer.exception.BusinessException;
import com.port.reefer.repository.AlarmRecordRepository;
import com.port.reefer.repository.InspectorRepository;
import com.port.reefer.repository.PluginReportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AlarmService {
    private static final Logger log = LoggerFactory.getLogger(AlarmService.class);
    
    private final AlarmRecordRepository alarmRecordRepository;
    private final InspectorRepository inspectorRepository;
    private final PluginReportRepository pluginReportRepository;
    private final AuditService auditService;

    public AlarmService(AlarmRecordRepository alarmRecordRepository,
                       InspectorRepository inspectorRepository,
                       PluginReportRepository pluginReportRepository,
                       AuditService auditService) {
        this.alarmRecordRepository = alarmRecordRepository;
        this.inspectorRepository = inspectorRepository;
        this.pluginReportRepository = pluginReportRepository;
        this.auditService = auditService;
    }

    @Transactional
    public AlarmRecord acknowledge(AlarmHandleRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        AlarmRecord alarm = alarmRecordRepository.findWithLockById(request.getAlarmId())
                .orElseThrow(() -> new BusinessException("报警记录不存在"));

        if (alarm.getStatus() != AlarmStatus.PENDING) {
            auditService.logDuplicateOperation("ACKNOWLEDGE_ALARM", "AlarmRecord", alarm.getId(),
                    inspector.getId(), "重复确认报警，当前状态: " + alarm.getStatus());
            throw new BusinessException("报警当前状态为" + alarm.getStatus() + "，无需重复确认");
        }

        AlarmRecord beforeAlarm = copyAlarm(alarm);

        alarm.setStatus(AlarmStatus.ACKNOWLEDGED);
        alarm.setAcknowledgedAt(LocalDateTime.now());
        alarm.setAcknowledgedBy(inspector.getId());
        alarm.setRemarks(request.getRemarks());
        alarmRecordRepository.save(alarm);

        updateReportAlarmCount(alarm.getContainerId());

        auditService.logOperation("ACKNOWLEDGE_ALARM", "AlarmRecord", alarm.getId(),
                inspector.getId(), beforeAlarm, alarm, request.getRemarks());

        log.info("报警确认成功: 报警ID={}, 巡检人={}", alarm.getId(), inspector.getName());
        return alarm;
    }

    @Transactional
    public AlarmRecord resolve(AlarmHandleRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        AlarmRecord alarm = alarmRecordRepository.findWithLockById(request.getAlarmId())
                .orElseThrow(() -> new BusinessException("报警记录不存在"));

        if (alarm.getStatus() == AlarmStatus.RESOLVED || alarm.getStatus() == AlarmStatus.FALSE_ALARM) {
            auditService.logDuplicateOperation("RESOLVE_ALARM", "AlarmRecord", alarm.getId(),
                    inspector.getId(), "重复处置报警，当前状态: " + alarm.getStatus());
            throw new BusinessException("报警当前状态为" + alarm.getStatus() + "，无需重复处置");
        }

        AlarmRecord beforeAlarm = copyAlarm(alarm);

        alarm.setStatus(AlarmStatus.RESOLVED);
        alarm.setResolvedAt(LocalDateTime.now());
        alarm.setResolvedBy(inspector.getId());
        alarm.setResolutionNotes(request.getResolutionNotes());
        alarm.setRemarks(request.getRemarks());
        if (alarm.getAcknowledgedAt() == null) {
            alarm.setAcknowledgedAt(LocalDateTime.now());
            alarm.setAcknowledgedBy(inspector.getId());
        }
        alarmRecordRepository.save(alarm);

        updateReportAlarmCount(alarm.getContainerId());

        auditService.logOperation("RESOLVE_ALARM", "AlarmRecord", alarm.getId(),
                inspector.getId(), beforeAlarm, alarm, request.getResolutionNotes());

        log.info("报警处置成功: 报警ID={}, 巡检人={}", alarm.getId(), inspector.getName());
        return alarm;
    }

    @Transactional
    public AlarmRecord markFalseAlarm(AlarmHandleRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        AlarmRecord alarm = alarmRecordRepository.findWithLockById(request.getAlarmId())
                .orElseThrow(() -> new BusinessException("报警记录不存在"));

        if (alarm.getStatus() == AlarmStatus.FALSE_ALARM) {
            auditService.logDuplicateOperation("FALSE_ALARM", "AlarmRecord", alarm.getId(),
                    inspector.getId(), "重复标记误报，当前状态: " + alarm.getStatus());
            throw new BusinessException("报警已标记为误报，无需重复操作");
        }

        AlarmRecord beforeAlarm = copyAlarm(alarm);

        alarm.setStatus(AlarmStatus.FALSE_ALARM);
        alarm.setResolvedAt(LocalDateTime.now());
        alarm.setResolvedBy(inspector.getId());
        alarm.setResolutionNotes(request.getResolutionNotes() != null ? request.getResolutionNotes() : "误报");
        alarm.setRemarks(request.getRemarks());
        if (alarm.getAcknowledgedAt() == null) {
            alarm.setAcknowledgedAt(LocalDateTime.now());
            alarm.setAcknowledgedBy(inspector.getId());
        }
        alarmRecordRepository.save(alarm);

        updateReportAlarmCount(alarm.getContainerId());

        auditService.logOperation("FALSE_ALARM", "AlarmRecord", alarm.getId(),
                inspector.getId(), beforeAlarm, alarm, request.getRemarks());

        log.info("报警标记为误报: 报警ID={}, 巡检人={}", alarm.getId(), inspector.getName());
        return alarm;
    }

    private void updateReportAlarmCount(Long containerId) {
        List<PluginReport> reports = pluginReportRepository.findByContainerIdOrderByPluginTimeDesc(containerId);
        if (reports.isEmpty()) {
            return;
        }

        PluginReport report = reports.get(0);
        List<AlarmRecord> alarms = alarmRecordRepository.findByContainerIdOrderByAlarmTimeDesc(containerId);

        int totalAlarms = alarms.size();
        long resolvedCount = alarms.stream()
                .filter(a -> a.getStatus() == AlarmStatus.RESOLVED || a.getStatus() == AlarmStatus.FALSE_ALARM)
                .count();

        report.setTotalAlarms(totalAlarms);
        report.setResolvedAlarms((int) resolvedCount);
        pluginReportRepository.save(report);
    }

    private AlarmRecord copyAlarm(AlarmRecord alarm) {
        AlarmRecord copy = new AlarmRecord();
        copy.setId(alarm.getId());
        copy.setStatus(alarm.getStatus());
        copy.setAcknowledgedAt(alarm.getAcknowledgedAt());
        copy.setResolvedAt(alarm.getResolvedAt());
        return copy;
    }

    public List<AlarmRecord> getPendingAlarms() {
        return alarmRecordRepository.findByStatus(AlarmStatus.PENDING);
    }

    public List<AlarmRecord> getContainerAlarms(String containerNumber) {
        return alarmRecordRepository.findAll();
    }

    public AlarmRecord getAlarmById(Long id) {
        return alarmRecordRepository.findById(id)
                .orElseThrow(() -> new BusinessException("报警记录不存在"));
    }
}
