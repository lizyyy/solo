package com.port.reefer.service;

import com.port.reefer.entity.*;
import com.port.reefer.entity.enums.AlarmStatus;
import com.port.reefer.exception.BusinessException;
import com.port.reefer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {
    private static final Logger log = LoggerFactory.getLogger(ReportService.class);
    
    private final PluginReportRepository pluginReportRepository;
    private final ReeferContainerRepository reeferContainerRepository;
    private final PowerSocketRepository powerSocketRepository;
    private final AlarmRecordRepository alarmRecordRepository;
    private final TemperatureSampleRepository temperatureSampleRepository;
    private final InspectorRepository inspectorRepository;

    public ReportService(PluginReportRepository pluginReportRepository,
                        ReeferContainerRepository reeferContainerRepository,
                        PowerSocketRepository powerSocketRepository,
                        AlarmRecordRepository alarmRecordRepository,
                        TemperatureSampleRepository temperatureSampleRepository,
                        InspectorRepository inspectorRepository) {
        this.pluginReportRepository = pluginReportRepository;
        this.reeferContainerRepository = reeferContainerRepository;
        this.powerSocketRepository = powerSocketRepository;
        this.alarmRecordRepository = alarmRecordRepository;
        this.temperatureSampleRepository = temperatureSampleRepository;
        this.inspectorRepository = inspectorRepository;
    }

    public Map<String, Object> getReportDetail(String reportNumber) {
        PluginReport report = pluginReportRepository.findByReportNumber(reportNumber)
                .orElseThrow(() -> new BusinessException("报告不存在"));

        return buildReportDetail(report);
    }

    public List<Map<String, Object>> getReportsByTime(LocalDateTime start, LocalDateTime end) {
        List<PluginReport> reports = pluginReportRepository.findByPluginTimeBetweenOrderByPluginTimeDesc(start, end);
        return reports.stream()
                .map(this::buildReportSummary)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getContainerReports(String containerNumber) {
        ReeferContainer container = reeferContainerRepository.findByContainerNumber(containerNumber)
                .orElseThrow(() -> new BusinessException("冷藏箱不存在"));

        List<PluginReport> reports = pluginReportRepository.findByContainerIdOrderByPluginTimeDesc(container.getId());
        return reports.stream()
                .map(this::buildReportSummary)
                .collect(Collectors.toList());
    }

    public Map<String, Object> getReviewData(LocalDateTime start, LocalDateTime end) {
        Map<String, Object> result = new HashMap<>();

        List<PluginReport> reports = pluginReportRepository.findByPluginTimeBetweenOrderByPluginTimeDesc(start, end);
        List<AlarmRecord> alarms = alarmRecordRepository.findAll();

        long totalPlugin = reports.size();
        long totalAlarms = alarms.size();
        long pendingAlarms = alarms.stream()
                .filter(a -> a.getStatus() == AlarmStatus.PENDING)
                .count();
        long resolvedAlarms = alarms.stream()
                .filter(a -> a.getStatus() == AlarmStatus.RESOLVED || a.getStatus() == AlarmStatus.FALSE_ALARM)
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalPluginCount", totalPlugin);
        stats.put("totalAlarmCount", totalAlarms);
        stats.put("pendingAlarmCount", pendingAlarms);
        stats.put("resolvedAlarmCount", resolvedAlarms);
        stats.put("alarmResolutionRate", totalAlarms > 0 ? (double) resolvedAlarms / totalAlarms : 0);

        result.put("statistics", stats);
        result.put("reports", reports.stream()
                .map(this::buildReportSummary)
                .collect(Collectors.toList()));

        return result;
    }

    public String exportReport(String reportNumber) {
        Map<String, Object> detail = getReportDetail(reportNumber);

        StringBuilder sb = new StringBuilder();
        sb.append("========== 冷藏箱插电报告 ==========\n");
        sb.append("报告编号: ").append(detail.get("reportNumber")).append("\n");
        sb.append("箱号: ").append(detail.get("containerNumber")).append("\n");
        sb.append("插座: ").append(detail.get("socketCode")).append("\n");
        sb.append("巡检人: ").append(detail.get("inspectorName")).append("\n");
        sb.append("插电时间: ").append(detail.get("pluginTime")).append("\n");
        if (detail.get("unplugTime") != null) {
            sb.append("断电时间: ").append(detail.get("unplugTime")).append("\n");
        }
        sb.append("状态: ").append(detail.get("status")).append("\n");
        sb.append("报警总数: ").append(detail.get("totalAlarms")).append("\n");
        sb.append("已处理报警: ").append(detail.get("resolvedAlarms")).append("\n");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> alarms = (List<Map<String, Object>>) detail.get("alarms");
        if (!alarms.isEmpty()) {
            sb.append("\n---------- 报警记录 ----------\n");
            for (Map<String, Object> alarm : alarms) {
                sb.append(String.format("[%s] %s - %s (当前: %s, 阈值: %s)\n",
                        alarm.get("alarmTime"),
                        alarm.get("alarmType"),
                        alarm.get("status"),
                        alarm.get("alarmValue"),
                        alarm.get("thresholdValue")));
            }
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> samples = (List<Map<String, Object>>) detail.get("temperatureSamples");
        if (!samples.isEmpty()) {
            sb.append("\n---------- 温度采样 ----------\n");
            for (Map<String, Object> sample : samples) {
                sb.append(String.format("[%s] 温度: %s°C (设定: %s°C)\n",
                        sample.get("sampleTime"),
                        sample.get("temperature"),
                        sample.get("setPoint")));
            }
        }

        sb.append("\n========== 报告结束 ==========\n");

        return sb.toString();
    }

    private Map<String, Object> buildReportSummary(PluginReport report) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", report.getId());
        result.put("reportNumber", report.getReportNumber());
        result.put("status", report.getStatus());
        result.put("pluginTime", report.getPluginTime());
        result.put("unplugTime", report.getUnplugTime());
        result.put("totalAlarms", report.getTotalAlarms());
        result.put("resolvedAlarms", report.getResolvedAlarms());

        reeferContainerRepository.findById(report.getContainerId())
                .ifPresent(c -> result.put("containerNumber", c.getContainerNumber()));

        powerSocketRepository.findById(report.getSocketId())
                .ifPresent(s -> result.put("socketCode", s.getSocketCode()));

        return result;
    }

    private Map<String, Object> buildReportDetail(PluginReport report) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", report.getId());
        result.put("reportNumber", report.getReportNumber());
        result.put("status", report.getStatus());
        result.put("pluginTime", report.getPluginTime());
        result.put("unplugTime", report.getUnplugTime());
        result.put("totalAlarms", report.getTotalAlarms());
        result.put("resolvedAlarms", report.getResolvedAlarms());
        result.put("remarks", report.getRemarks());

        reeferContainerRepository.findById(report.getContainerId())
                .ifPresent(c -> {
                    result.put("containerId", c.getId());
                    result.put("containerNumber", c.getContainerNumber());
                    result.put("targetTemperature", c.getTargetTemperature());
                });

        powerSocketRepository.findById(report.getSocketId())
                .ifPresent(s -> {
                    result.put("socketId", s.getId());
                    result.put("socketCode", s.getSocketCode());
                    result.put("socketLocation", s.getLocation());
                });

        inspectorRepository.findById(report.getInspectorId())
                .ifPresent(i -> {
                    result.put("inspectorId", i.getId());
                    result.put("inspectorName", i.getName());
                    result.put("inspectorBadge", i.getBadgeNumber());
                });

        List<AlarmRecord> alarms = alarmRecordRepository.findByContainerIdOrderByAlarmTimeDesc(report.getContainerId());
        result.put("alarms", alarms.stream()
                .map(a -> {
                    Map<String, Object> am = new HashMap<>();
                    am.put("id", a.getId());
                    am.put("alarmType", a.getAlarmType());
                    am.put("status", a.getStatus());
                    am.put("alarmValue", a.getAlarmValue());
                    am.put("thresholdValue", a.getThresholdValue());
                    am.put("alarmTime", a.getAlarmTime());
                    am.put("acknowledgedAt", a.getAcknowledgedAt());
                    am.put("resolvedAt", a.getResolvedAt());
                    return am;
                })
                .collect(Collectors.toList()));

        List<TemperatureSample> samples = temperatureSampleRepository.findByContainerIdOrderBySampleTimeDesc(report.getContainerId());
        result.put("temperatureSamples", samples.stream()
                .limit(20)
                .map(s -> {
                    Map<String, Object> sm = new HashMap<>();
                    sm.put("id", s.getId());
                    sm.put("temperature", s.getTemperature());
                    sm.put("setPoint", s.getSetPoint());
                    sm.put("sampleTime", s.getSampleTime());
                    return sm;
                })
                .collect(Collectors.toList()));

        return result;
    }
}
