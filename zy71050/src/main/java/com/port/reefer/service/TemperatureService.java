package com.port.reefer.service;

import com.port.reefer.dto.TemperatureSampleRequest;
import com.port.reefer.entity.AlarmRecord;
import com.port.reefer.entity.Inspector;
import com.port.reefer.entity.PowerSocket;
import com.port.reefer.entity.ReeferContainer;
import com.port.reefer.entity.TemperatureSample;
import com.port.reefer.entity.enums.AlarmStatus;
import com.port.reefer.entity.enums.AlarmType;
import com.port.reefer.exception.BusinessException;
import com.port.reefer.repository.AlarmRecordRepository;
import com.port.reefer.repository.InspectorRepository;
import com.port.reefer.repository.PowerSocketRepository;
import com.port.reefer.repository.ReeferContainerRepository;
import com.port.reefer.repository.TemperatureSampleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class TemperatureService {
    private static final Logger log = LoggerFactory.getLogger(TemperatureService.class);
    
    private final TemperatureSampleRepository temperatureSampleRepository;
    private final ReeferContainerRepository reeferContainerRepository;
    private final PowerSocketRepository powerSocketRepository;
    private final InspectorRepository inspectorRepository;
    private final AlarmRecordRepository alarmRecordRepository;
    private final AuditService auditService;

    private static final BigDecimal TEMP_THRESHOLD = new BigDecimal("3");

    public TemperatureService(TemperatureSampleRepository temperatureSampleRepository,
                             ReeferContainerRepository reeferContainerRepository,
                             PowerSocketRepository powerSocketRepository,
                             InspectorRepository inspectorRepository,
                             AlarmRecordRepository alarmRecordRepository,
                             AuditService auditService) {
        this.temperatureSampleRepository = temperatureSampleRepository;
        this.reeferContainerRepository = reeferContainerRepository;
        this.powerSocketRepository = powerSocketRepository;
        this.inspectorRepository = inspectorRepository;
        this.alarmRecordRepository = alarmRecordRepository;
        this.auditService = auditService;
    }

    @Transactional
    public TemperatureSample addSample(TemperatureSampleRequest request) {
        Inspector inspector = inspectorRepository.findByBadgeNumber(request.getInspectorBadge())
                .orElseThrow(() -> new BusinessException("巡检人不存在"));

        ReeferContainer container = reeferContainerRepository.findByContainerNumber(request.getContainerNumber())
                .orElseThrow(() -> new BusinessException("冷藏箱不存在，请先执行插电操作"));

        Long socketId = null;
        if (request.getSocketCode() != null) {
            PowerSocket socket = powerSocketRepository.findBySocketCode(request.getSocketCode())
                    .orElseThrow(() -> new BusinessException("插座不存在"));
            socketId = socket.getId();
        }

        TemperatureSample sample = new TemperatureSample();
        sample.setContainerId(container.getId());
        sample.setSocketId(socketId);
        sample.setTemperature(request.getTemperature());
        sample.setSetPoint(request.getSetPoint() != null ? request.getSetPoint() : container.getTargetTemperature());
        sample.setAmbientTemperature(request.getAmbientTemperature());
        sample.setSampleTime(request.getSampleTime() != null ? request.getSampleTime() : LocalDateTime.now());
        sample.setInspectorId(inspector.getId());
        sample.setRemarks(request.getRemarks());
        temperatureSampleRepository.save(sample);

        checkAndCreateAlarm(container, sample, inspector);

        auditService.logOperation("ADD_TEMPERATURE_SAMPLE", "TemperatureSample", sample.getId(),
                inspector.getId(), null, sample, "温度采样，箱号: " + container.getContainerNumber());

        log.info("温度采样成功: 箱号={}, 温度={}, 巡检人={}", container.getContainerNumber(), sample.getTemperature(), inspector.getName());
        return sample;
    }

    private void checkAndCreateAlarm(ReeferContainer container, TemperatureSample sample, Inspector inspector) {
        BigDecimal targetTemp = container.getTargetTemperature();
        if (targetTemp == null) {
            return;
        }

        BigDecimal diff = sample.getTemperature().subtract(targetTemp).abs();

        if (diff.compareTo(TEMP_THRESHOLD) > 0) {
            AlarmType alarmType = sample.getTemperature().compareTo(targetTemp) > 0
                    ? AlarmType.TEMPERATURE_HIGH
                    : AlarmType.TEMPERATURE_LOW;

            List<AlarmRecord> pendingAlarms = alarmRecordRepository.findByContainerIdAndStatus(
                    container.getId(), AlarmStatus.PENDING);

            boolean hasSameTypePending = pendingAlarms.stream()
                    .anyMatch(a -> a.getAlarmType() == alarmType);

            if (!hasSameTypePending) {
                AlarmRecord alarm = new AlarmRecord();
                alarm.setContainerId(container.getId());
                alarm.setSocketId(sample.getSocketId());
                alarm.setAlarmType(alarmType);
                alarm.setStatus(AlarmStatus.PENDING);
                alarm.setAlarmValue(sample.getTemperature());
                alarm.setThresholdValue(targetTemp);
                alarm.setAlarmTime(sample.getSampleTime());
                alarmRecordRepository.save(alarm);

                auditService.logOperation("CREATE_ALARM", "AlarmRecord", alarm.getId(),
                        inspector.getId(), null, alarm,
                        "温度报警: " + alarmType + ", 当前温度: " + sample.getTemperature());

                log.warn("温度报警: 箱号={}, 类型={}, 当前温度={}, 目标温度={}",
                        container.getContainerNumber(), alarmType, sample.getTemperature(), targetTemp);
            }
        }
    }

    public List<TemperatureSample> getContainerSamples(String containerNumber) {
        ReeferContainer container = reeferContainerRepository.findByContainerNumber(containerNumber)
                .orElseThrow(() -> new BusinessException("冷藏箱不存在"));
        return temperatureSampleRepository.findByContainerIdOrderBySampleTimeDesc(container.getId());
    }

    public List<TemperatureSample> getContainerSamplesByTime(String containerNumber, LocalDateTime start, LocalDateTime end) {
        ReeferContainer container = reeferContainerRepository.findByContainerNumber(containerNumber)
                .orElseThrow(() -> new BusinessException("冷藏箱不存在"));
        return temperatureSampleRepository.findByContainerIdAndSampleTimeBetweenOrderBySampleTimeDesc(
                container.getId(), start, end);
    }
}
