package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.forklift.entity.ChargingStation;
import com.forklift.mapper.ChargingStationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ChargingStationService {

    @Autowired
    private ChargingStationMapper stationMapper;

    @Autowired
    private ChangeHistoryService changeHistoryService;

    public List<ChargingStation> getAllStations() {
        return stationMapper.selectList(null);
    }

    public List<ChargingStation> getAvailableStations() {
        QueryWrapper<ChargingStation> wrapper = new QueryWrapper<>();
        wrapper.eq("status", "AVAILABLE")
               .gt("health_score", 60);
        return stationMapper.selectList(wrapper);
    }

    public ChargingStation getById(Long id) {
        return stationMapper.selectById(id);
    }

    @Transactional
    public ChargingStation create(ChargingStation station) {
        stationMapper.insert(station);
        return station;
    }

    @Transactional
    public ChargingStation update(Long id, ChargingStation station, String operator) {
        ChargingStation oldStation = stationMapper.selectById(id);
        if (oldStation == null) {
            throw new RuntimeException("充电桩不存在");
        }
        
        if (station.getStatus() != null && !station.getStatus().equals(oldStation.getStatus())) {
            changeHistoryService.recordChange("CHARGING_STATION", id, "status", 
                oldStation.getStatus(), station.getStatus(), "UPDATE", operator, 
                "充电桩状态变更");
        }
        
        if (station.getHealthScore() != null && !station.getHealthScore().equals(oldStation.getHealthScore())) {
            changeHistoryService.recordChange("CHARGING_STATION", id, "healthScore", 
                oldStation.getHealthScore(), station.getHealthScore(), "UPDATE", operator, 
                "充电桩健康分数变更");
        }

        station.setId(id);
        stationMapper.updateById(station);
        return stationMapper.selectById(id);
    }

    @Transactional
    public void markFaulty(Long id, String operator, String reason) {
        ChargingStation station = stationMapper.selectById(id);
        if (station == null) {
            throw new RuntimeException("充电桩不存在");
        }
        
        String oldStatus = station.getStatus();
        UpdateWrapper<ChargingStation> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id)
               .set("status", "FAULTY");
        stationMapper.update(null, wrapper);
        
        changeHistoryService.recordChange("CHARGING_STATION", id, "status", 
            oldStatus, "FAULTY", "MARK_FAULTY", operator, reason);
    }

    @Transactional
    public void assignTask(Long stationId, Long taskId, String operator) {
        ChargingStation station = stationMapper.selectById(stationId);
        if (station == null) {
            throw new RuntimeException("充电桩不存在");
        }
        if (!"AVAILABLE".equals(station.getStatus())) {
            throw new RuntimeException("充电桩不可用");
        }

        Long oldTaskId = station.getCurrentTaskId();
        UpdateWrapper<ChargingStation> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", stationId)
               .set("status", "OCCUPIED")
               .set("current_task_id", taskId);
        stationMapper.update(null, wrapper);
        
        changeHistoryService.recordChange("CHARGING_STATION", stationId, "currentTaskId", 
            oldTaskId, taskId, "ASSIGN_TASK", operator, "分配充电任务");
        changeHistoryService.recordChange("CHARGING_STATION", stationId, "status", 
            "AVAILABLE", "OCCUPIED", "UPDATE", operator, "充电桩状态变更为占用");
    }

    @Transactional
    public void releaseStation(Long stationId, String operator) {
        ChargingStation station = stationMapper.selectById(stationId);
        if (station == null) {
            throw new RuntimeException("充电桩不存在");
        }

        Long oldTaskId = station.getCurrentTaskId();
        UpdateWrapper<ChargingStation> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", stationId)
               .set("status", "AVAILABLE")
               .set("current_task_id", null);
        stationMapper.update(null, wrapper);
        
        changeHistoryService.recordChange("CHARGING_STATION", stationId, "currentTaskId", 
            oldTaskId, null, "RELEASE", operator, "释放充电任务");
        changeHistoryService.recordChange("CHARGING_STATION", stationId, "status", 
            "OCCUPIED", "AVAILABLE", "UPDATE", operator, "充电桩状态变更为可用");
    }
}
