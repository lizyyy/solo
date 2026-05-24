package com.port.reefer.service;

import com.port.reefer.entity.*;
import com.port.reefer.entity.enums.AlarmStatus;
import com.port.reefer.entity.enums.SocketStatus;
import com.port.reefer.exception.BusinessException;
import com.port.reefer.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ValidationService {
    private static final Logger log = LoggerFactory.getLogger(ValidationService.class);
    
    private final PowerSocketRepository powerSocketRepository;
    private final ReeferContainerRepository reeferContainerRepository;
    private final AlarmRecordRepository alarmRecordRepository;
    private final PluginReportRepository pluginReportRepository;
    private final TemperatureSampleRepository temperatureSampleRepository;

    public ValidationService(PowerSocketRepository powerSocketRepository,
                            ReeferContainerRepository reeferContainerRepository,
                            AlarmRecordRepository alarmRecordRepository,
                            PluginReportRepository pluginReportRepository,
                            TemperatureSampleRepository temperatureSampleRepository) {
        this.powerSocketRepository = powerSocketRepository;
        this.reeferContainerRepository = reeferContainerRepository;
        this.alarmRecordRepository = alarmRecordRepository;
        this.pluginReportRepository = pluginReportRepository;
        this.temperatureSampleRepository = temperatureSampleRepository;
    }

    public Map<String, Object> validateSocket(String socketCode) {
        PowerSocket socket = powerSocketRepository.findBySocketCode(socketCode)
                .orElseThrow(() -> new BusinessException("插座不存在"));

        Map<String, Object> result = new HashMap<>();
        result.put("socketCode", socket.getSocketCode());
        result.put("status", socket.getStatus());
        result.put("location", socket.getLocation());
        result.put("isAvailable", socket.getStatus() == SocketStatus.AVAILABLE);

        if (socket.getStatus() == SocketStatus.OCCUPIED && socket.getOccupiedByContainerId() != null) {
            reeferContainerRepository.findById(socket.getOccupiedByContainerId())
                    .ifPresent(c -> {
                        result.put("occupiedByContainer", c.getContainerNumber());
                        result.put("occupiedAt", socket.getOccupiedAt());
                    });
        }

        List<PluginReport> recentReports = pluginReportRepository.findBySocketIdOrderByPluginTimeDesc(socket.getId());
        result.put("totalUsageCount", recentReports.size());
        if (!recentReports.isEmpty()) {
            result.put("lastUsedAt", recentReports.get(0).getPluginTime());
        }

        return result;
    }

    public Map<String, Object> validateContainer(String containerNumber) {
        ReeferContainer container = reeferContainerRepository.findByContainerNumber(containerNumber)
                .orElseThrow(() -> new BusinessException("冷藏箱不存在"));

        Map<String, Object> result = new HashMap<>();
        result.put("containerNumber", container.getContainerNumber());
        result.put("targetTemperature", container.getTargetTemperature());
        result.put("vesselName", container.getVesselName());
        result.put("voyageNumber", container.getVoyageNumber());

        List<PowerSocket> occupiedSockets = powerSocketRepository.findByOccupiedByContainerId(container.getId());
        result.put("isPluggedIn", !occupiedSockets.isEmpty());
        if (!occupiedSockets.isEmpty()) {
            result.put("currentSocket", occupiedSockets.get(0).getSocketCode());
        }

        List<AlarmRecord> pendingAlarms = alarmRecordRepository.findByContainerIdAndStatus(
                container.getId(), AlarmStatus.PENDING);
        result.put("pendingAlarmCount", pendingAlarms.size());
        result.put("hasPendingAlarms", !pendingAlarms.isEmpty());

        List<TemperatureSample> samples = temperatureSampleRepository.findByContainerIdOrderBySampleTimeDesc(container.getId());
        if (!samples.isEmpty()) {
            result.put("lastTemperature", samples.get(0).getTemperature());
            result.put("lastSampleTime", samples.get(0).getSampleTime());
        }

        return result;
    }

    public Map<String, Object> validatePlugin(String containerNumber, String socketCode) {
        Map<String, Object> result = new HashMap<>();
        result.put("valid", true);
        result.put("issues", new java.util.ArrayList<>());

        try {
            Map<String, Object> socketValidation = validateSocket(socketCode);
            if (!(boolean) socketValidation.get("isAvailable")) {
                result.put("valid", false);
                @SuppressWarnings("unchecked")
                List<String> issues = (List<String>) result.get("issues");
                issues.add("插座不可用，当前状态: " + socketValidation.get("status"));
            }
        } catch (BusinessException e) {
            result.put("valid", false);
            @SuppressWarnings("unchecked")
            List<String> issues = (List<String>) result.get("issues");
            issues.add(e.getMessage());
        }

        try {
            Map<String, Object> containerValidation = validateContainer(containerNumber);
            if ((boolean) containerValidation.get("isPluggedIn")) {
                result.put("valid", false);
                @SuppressWarnings("unchecked")
                List<String> issues = (List<String>) result.get("issues");
                issues.add("冷藏箱已插电，当前插座: " + containerValidation.get("currentSocket"));
            }
        } catch (BusinessException e) {
            // 容器不存在是正常的，新建即可
        }

        return result;
    }

    public Map<String, Object> supplementProof(Long reportId, String inspectorBadge, String remarks) {
        PluginReport report = pluginReportRepository.findById(reportId)
                .orElseThrow(() -> new BusinessException("报告不存在"));

        if (report.getUnplugTime() == null) {
            throw new BusinessException("报告未完成断电，无法补证");
        }

        report.setRemarks((report.getRemarks() != null ? report.getRemarks() + "\n" : "") + "[补证] " + remarks);
        pluginReportRepository.save(report);

        Map<String, Object> result = new HashMap<>();
        result.put("reportId", report.getId());
        result.put("reportNumber", report.getReportNumber());
        result.put("updatedRemarks", report.getRemarks());

        return result;
    }
}
