package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.forklift.entity.AnomalyRecord;
import com.forklift.mapper.AnomalyRecordMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnomalyService {

    @Autowired
    private AnomalyRecordMapper anomalyMapper;

    public List<AnomalyRecord> getAllAnomalies() {
        QueryWrapper<AnomalyRecord> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("created_at");
        return anomalyMapper.selectList(wrapper);
    }

    public List<AnomalyRecord> getPendingAnomalies() {
        QueryWrapper<AnomalyRecord> wrapper = new QueryWrapper<>();
        wrapper.eq("status", "PENDING")
               .orderByDesc("severity")
               .orderByDesc("created_at");
        return anomalyMapper.selectList(wrapper);
    }

    public List<AnomalyRecord> getAnomaliesByType(String type) {
        QueryWrapper<AnomalyRecord> wrapper = new QueryWrapper<>();
        wrapper.eq("anomaly_type", type)
               .orderByDesc("created_at");
        return anomalyMapper.selectList(wrapper);
    }

    public List<AnomalyRecord> getAnomaliesByHandler(String handler) {
        QueryWrapper<AnomalyRecord> wrapper = new QueryWrapper<>();
        wrapper.eq("handled_by", handler)
               .orderByDesc("handled_at");
        return anomalyMapper.selectList(wrapper);
    }

    public AnomalyRecord getById(Long id) {
        return anomalyMapper.selectById(id);
    }

    @Transactional
    public AnomalyRecord createAnomaly(AnomalyRecord anomaly) {
        if (anomaly.getSeverity() == null) {
            anomaly.setSeverity("MEDIUM");
        }
        if (anomaly.getStatus() == null) {
            anomaly.setStatus("PENDING");
        }
        anomalyMapper.insert(anomaly);
        return anomaly;
    }

    @Transactional
    public void createStationFaultAnomaly(Long stationId, String stationCode, String reason) {
        AnomalyRecord anomaly = new AnomalyRecord();
        anomaly.setAnomalyType("STATION_FAULT");
        anomaly.setAnomalyCode("SF-" + System.currentTimeMillis());
        anomaly.setTitle("充电桩故障: " + stationCode);
        anomaly.setDescription(reason);
        anomaly.setSource("CHARGING_STATION");
        anomaly.setSourceId(stationId);
        anomaly.setSeverity("HIGH");
        anomaly.setStatus("PENDING");
        anomalyMapper.insert(anomaly);
    }

    @Transactional
    public void createBatteryHealthAnomaly(Long batteryId, String batteryCode, String reason) {
        AnomalyRecord anomaly = new AnomalyRecord();
        anomaly.setAnomalyType("BATTERY_HEALTH");
        anomaly.setAnomalyCode("BH-" + System.currentTimeMillis());
        anomaly.setTitle("电池健康异常: " + batteryCode);
        anomaly.setDescription(reason);
        anomaly.setSource("BATTERY");
        anomaly.setSourceId(batteryId);
        anomaly.setSeverity("MEDIUM");
        anomaly.setStatus("PENDING");
        anomalyMapper.insert(anomaly);
    }

    @Transactional
    public void createLowBatteryAnomaly(Long batteryId, String batteryCode, Integer currentSoc) {
        AnomalyRecord anomaly = new AnomalyRecord();
        anomaly.setAnomalyType("LOW_BATTERY");
        anomaly.setAnomalyCode("LB-" + System.currentTimeMillis());
        anomaly.setTitle("电池电量过低: " + batteryCode);
        anomaly.setDescription("当前电量: " + currentSoc + "%，低于安全阈值");
        anomaly.setSource("BATTERY");
        anomaly.setSourceId(batteryId);
        anomaly.setSeverity("HIGH");
        anomaly.setStatus("PENDING");
        anomalyMapper.insert(anomaly);
    }

    @Transactional
    public void createWaveConflictAnomaly(Long waveId, String waveCode, String reason) {
        AnomalyRecord anomaly = new AnomalyRecord();
        anomaly.setAnomalyType("WAVE_CONFLICT");
        anomaly.setAnomalyCode("WC-" + System.currentTimeMillis());
        anomaly.setTitle("作业波次冲突: " + waveCode);
        anomaly.setDescription(reason);
        anomaly.setSource("WORK_WAVE");
        anomaly.setSourceId(waveId);
        anomaly.setSeverity("MEDIUM");
        anomaly.setStatus("PENDING");
        anomalyMapper.insert(anomaly);
    }

    @Transactional
    public AnomalyRecord handleAnomaly(Long id, String handler, String notes) {
        AnomalyRecord anomaly = anomalyMapper.selectById(id);
        if (anomaly == null) {
            throw new RuntimeException("异常记录不存在");
        }

        UpdateWrapper<AnomalyRecord> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id)
               .set("status", "HANDLED")
               .set("handled_at", LocalDateTime.now())
               .set("handled_by", handler)
               .set("handling_notes", notes);
        anomalyMapper.update(null, wrapper);
        
        return anomalyMapper.selectById(id);
    }

    @Transactional
    public AnomalyRecord assignAnomaly(Long id, String assignee, String operator) {
        AnomalyRecord anomaly = anomalyMapper.selectById(id);
        if (anomaly == null) {
            throw new RuntimeException("异常记录不存在");
        }

        UpdateWrapper<AnomalyRecord> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id)
               .set("assigned_to", assignee);
        anomalyMapper.update(null, wrapper);
        
        return anomalyMapper.selectById(id);
    }
}
