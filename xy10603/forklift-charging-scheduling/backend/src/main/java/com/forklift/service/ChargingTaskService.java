package com.forklift.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.forklift.entity.*;
import com.forklift.mapper.ChargingTaskMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class ChargingTaskService {

    @Autowired
    private ChargingTaskMapper taskMapper;

    @Autowired
    private BatteryService batteryService;

    @Autowired
    private ChargingStationService stationService;

    @Autowired
    private WorkWaveService waveService;

    @Autowired
    private AnomalyService anomalyService;

    @Autowired
    private ChangeHistoryService changeHistoryService;

    public List<ChargingTask> getAllTasks() {
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("created_at");
        return taskMapper.selectList(wrapper);
    }

    public List<ChargingTask> getTasksByStatus(String status) {
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        wrapper.eq("status", status)
               .orderByDesc("is_urgent")
               .orderByAsc("priority")
               .orderByAsc("created_at");
        return taskMapper.selectList(wrapper);
    }

    public List<ChargingTask> getTasksByWave(Long waveId) {
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        wrapper.eq("wave_id", waveId)
               .orderByDesc("created_at");
        return taskMapper.selectList(wrapper);
    }

    public List<ChargingTask> getUrgentTasks() {
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        wrapper.eq("is_urgent", true)
               .in("status", "PENDING", "QUEUED")
               .orderByAsc("priority");
        return taskMapper.selectList(wrapper);
    }

    public ChargingTask getById(Long id) {
        return taskMapper.selectById(id);
    }

    public Map<String, Object> getTaskStatusSummary() {
        Map<String, Object> summary = new HashMap<>();
        QueryWrapper<ChargingTask> wrapper;
        
        wrapper = new QueryWrapper<>();
        wrapper.eq("status", "PENDING");
        summary.put("pending", taskMapper.selectCount(wrapper));
        
        wrapper = new QueryWrapper<>();
        wrapper.eq("status", "CHARGING");
        summary.put("charging", taskMapper.selectCount(wrapper));
        
        wrapper = new QueryWrapper<>();
        wrapper.eq("status", "COMPLETED");
        summary.put("completed", taskMapper.selectCount(wrapper));
        
        wrapper = new QueryWrapper<>();
        wrapper.eq("is_urgent", true);
        summary.put("urgent", taskMapper.selectCount(wrapper));
        
        return summary;
    }

    @Transactional
    public ChargingTask createTask(ChargingTask task, String operator) {
        Battery battery = batteryService.getById(task.getBatteryId());
        if (battery == null) {
            throw new RuntimeException("电池不存在");
        }

        if (!"GOOD".equals(battery.getHealthStatus())) {
            anomalyService.createBatteryHealthAnomaly(battery.getId(), battery.getBatteryCode(), 
                "电池健康状态异常: " + battery.getHealthStatus());
        }

        if (battery.getCurrentSoc() >= 95) {
            throw new RuntimeException("电池电量充足，无需充电");
        }

        if (task.getWaveId() != null) {
            if (!waveService.validateWaveForTask(task.getWaveId(), LocalDateTime.now())) {
                throw new RuntimeException("作业波次校验失败");
            }
        }

        task.setTaskCode("CT-" + IdUtil.getSnowflakeNextIdStr());
        task.setStatus("PENDING");
        task.setCurrentSoc(battery.getCurrentSoc());
        if (task.getTargetSoc() == null) {
            task.setTargetSoc(100);
        }
        if (task.getPriority() == null) {
            task.setPriority(5);
        }
        if (task.getIsUrgent() == null) {
            task.setIsUrgent(false);
        }
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        task.setCreatedBy(operator);

        taskMapper.insert(task);

        if (task.getWaveId() != null) {
            waveService.incrementActualForklifts(task.getWaveId());
        }

        return task;
    }

    @Transactional
    public ChargingTask updateTask(Long id, ChargingTask task, String operator) {
        ChargingTask oldTask = taskMapper.selectById(id);
        if (oldTask == null) {
            throw new RuntimeException("充电任务不存在");
        }

        if (task.getPriority() != null && !task.getPriority().equals(oldTask.getPriority())) {
            changeHistoryService.recordChange("CHARGING_TASK", id, "priority", 
                oldTask.getPriority(), task.getPriority(), "UPDATE", operator, 
                "任务优先级调整");
        }

        if (task.getIsUrgent() != null && !task.getIsUrgent().equals(oldTask.getIsUrgent())) {
            changeHistoryService.recordChange("CHARGING_TASK", id, "isUrgent", 
                oldTask.getIsUrgent(), task.getIsUrgent(), "UPDATE", operator, 
                "任务紧急状态调整");
        }

        if (task.getRemarks() != null && !task.getRemarks().equals(oldTask.getRemarks())) {
            changeHistoryService.recordChange("CHARGING_TASK", id, "remarks", 
                oldTask.getRemarks(), task.getRemarks(), "UPDATE", operator, 
                "任务备注更新");
        }

        task.setId(id);
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
        
        return taskMapper.selectById(id);
    }

    @Transactional
    public ChargingTask assignStation(Long taskId, Long stationId, String operator) {
        ChargingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new RuntimeException("充电任务不存在");
        }
        if (!"PENDING".equals(task.getStatus()) && !"QUEUED".equals(task.getStatus())) {
            throw new RuntimeException("任务状态不允许分配充电桩");
        }

        ChargingStation station = stationService.getById(stationId);
        if (station == null) {
            throw new RuntimeException("充电桩不存在");
        }
        if ("FAULTY".equals(station.getStatus())) {
            anomalyService.createStationFaultAnomaly(stationId, station.getStationCode(), 
                "尝试分配故障充电桩");
            throw new RuntimeException("充电桩故障，无法使用");
        }
        if ("OCCUPIED".equals(station.getStatus())) {
            throw new RuntimeException("充电桩已被占用");
        }

        String oldStatus = task.getStatus();
        Long oldStationId = task.getStationId();
        UpdateWrapper<ChargingTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
               .set("station_id", stationId)
               .set("status", "ASSIGNED")
               .set("updated_at", LocalDateTime.now());
        taskMapper.update(null, wrapper);

        changeHistoryService.recordChange("CHARGING_TASK", taskId, "stationId", 
            oldStationId, stationId, "ASSIGN_STATION", operator, "分配充电桩: " + station.getStationCode());
        changeHistoryService.recordChange("CHARGING_TASK", taskId, "status", 
            oldStatus, "ASSIGNED", "UPDATE", operator, "任务状态变更");

        stationService.assignTask(stationId, taskId, operator);

        return taskMapper.selectById(taskId);
    }

    @Transactional
    public ChargingTask startCharging(Long taskId, String operator) {
        ChargingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new RuntimeException("充电任务不存在");
        }
        if (!"ASSIGNED".equals(task.getStatus())) {
            throw new RuntimeException("任务状态不允许开始充电");
        }

        Battery battery = batteryService.getById(task.getBatteryId());
        if (battery == null) {
            throw new RuntimeException("电池不存在");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime estimatedEnd = calculateEstimatedEndTime(battery, task.getTargetSoc());

        String oldStatus = task.getStatus();
        UpdateWrapper<ChargingTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
               .set("status", "CHARGING")
               .set("actual_start_time", now)
               .set("estimated_end_time", estimatedEnd)
               .set("updated_at", now);
        taskMapper.update(null, wrapper);

        changeHistoryService.recordChange("CHARGING_TASK", taskId, "status", 
            oldStatus, "CHARGING", "START_CHARGING", operator, "开始充电");

        return taskMapper.selectById(taskId);
    }

    @Transactional
    public ChargingTask completeCharging(Long taskId, Integer finalSoc, String operator) {
        ChargingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new RuntimeException("充电任务不存在");
        }
        if (!"CHARGING".equals(task.getStatus())) {
            throw new RuntimeException("任务状态不允许完成");
        }

        LocalDateTime now = LocalDateTime.now();
        String oldStatus = task.getStatus();
        
        UpdateWrapper<ChargingTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
               .set("status", "COMPLETED")
               .set("actual_end_time", now)
               .set("current_soc", finalSoc)
               .set("updated_at", now);
        taskMapper.update(null, wrapper);

        changeHistoryService.recordChange("CHARGING_TASK", taskId, "status", 
            oldStatus, "COMPLETED", "COMPLETE", operator, "充电完成");

        if (task.getStationId() != null) {
            stationService.releaseStation(task.getStationId(), operator);
        }

        batteryService.updateSoc(task.getBatteryId(), finalSoc, operator);

        return taskMapper.selectById(taskId);
    }

    @Transactional
    public ChargingTask cancelTask(Long taskId, String reason, String operator) {
        ChargingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new RuntimeException("充电任务不存在");
        }
        if ("COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) {
            throw new RuntimeException("任务已完成或已取消");
        }

        String oldStatus = task.getStatus();
        UpdateWrapper<ChargingTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
               .set("status", "CANCELLED")
               .set("remarks", reason)
               .set("updated_at", LocalDateTime.now());
        taskMapper.update(null, wrapper);

        changeHistoryService.recordChange("CHARGING_TASK", taskId, "status", 
            oldStatus, "CANCELLED", "CANCEL", operator, reason);

        if (task.getStationId() != null && ("ASSIGNED".equals(oldStatus) || "CHARGING".equals(oldStatus))) {
            stationService.releaseStation(task.getStationId(), operator);
        }

        return taskMapper.selectById(taskId);
    }

    @Transactional
    public ChargingTask adjustPriority(Long taskId, Integer newPriority, String operator, String reason) {
        ChargingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new RuntimeException("充电任务不存在");
        }

        Integer oldPriority = task.getPriority();
        UpdateWrapper<ChargingTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
               .set("priority", newPriority)
               .set("updated_at", LocalDateTime.now());
        taskMapper.update(null, wrapper);

        changeHistoryService.recordChange("CHARGING_TASK", taskId, "priority", 
            oldPriority, newPriority, "ADJUST_PRIORITY", operator, reason);

        return taskMapper.selectById(taskId);
    }

    public LocalDateTime calculateEstimatedEndTime(Battery battery, Integer targetSoc) {
        int chargingRate = 20;
        int socToCharge = targetSoc - battery.getCurrentSoc();
        double hoursNeeded = (socToCharge / 100.0 * battery.getCapacityKwh().doubleValue()) / chargingRate;
        return LocalDateTime.now().plusMinutes((long) (hoursNeeded * 60));
    }

    public Map<String, Object> getPowerForecast() {
        Map<String, Object> forecast = new HashMap<>();
        List<ChargingTask> chargingTasks = getTasksByStatus("CHARGING");
        
        int totalPower = 0;
        List<Map<String, Object>> details = new ArrayList<>();
        
        for (ChargingTask task : chargingTasks) {
            ChargingStation station = stationService.getById(task.getStationId());
            Battery battery = batteryService.getById(task.getBatteryId());
            if (station != null && battery != null) {
                Map<String, Object> detail = new HashMap<>();
                detail.put("taskId", task.getId());
                detail.put("taskCode", task.getTaskCode());
                detail.put("stationCode", station.getStationCode());
                detail.put("batteryCode", battery.getBatteryCode());
                detail.put("power", station.getMaxPower());
                detail.put("currentSoc", task.getCurrentSoc());
                detail.put("targetSoc", task.getTargetSoc());
                detail.put("estimatedEnd", task.getEstimatedEndTime());
                details.add(detail);
                totalPower += station.getMaxPower();
            }
        }
        
        forecast.put("totalPower", totalPower);
        forecast.put("chargingCount", chargingTasks.size());
        forecast.put("details", details);
        
        return forecast;
    }

    public List<Map<String, Object>> getExportData(Map<String, Object> filters) {
        List<Map<String, Object>> result = new ArrayList<>();
        
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        if (filters.get("assignedOperator") != null) {
            wrapper.eq("assigned_operator", filters.get("assignedOperator"));
        }
        if (filters.get("startTime") != null && filters.get("endTime") != null) {
            wrapper.between("created_at", filters.get("startTime"), filters.get("endTime"));
        }
        if (filters.get("handledBy") != null) {
            wrapper.eq("created_by", filters.get("handledBy"));
        }
        wrapper.orderByDesc("created_at");
        
        List<ChargingTask> tasks = taskMapper.selectList(wrapper);
        
        for (ChargingTask task : tasks) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("任务编号", task.getTaskCode());
            row.put("状态", task.getStatus());
            row.put("优先级", task.getPriority());
            row.put("是否紧急", task.getIsUrgent() ? "是" : "否");
            
            Battery battery = batteryService.getById(task.getBatteryId());
            row.put("电池编号", battery != null ? battery.getBatteryCode() : "");
            row.put("叉车编号", battery != null ? battery.getForkliftCode() : "");
            row.put("电池健康状态", battery != null ? battery.getHealthStatus() : "");
            
            ChargingStation station = task.getStationId() != null ? stationService.getById(task.getStationId()) : null;
            row.put("充电桩编号", station != null ? station.getStationCode() : "");
            row.put("充电桩状态", station != null ? station.getStatus() : "");
            
            if (task.getWaveId() != null) {
                WorkWave wave = waveService.getById(task.getWaveId());
                row.put("作业波次", wave != null ? wave.getWaveName() : "");
            } else {
                row.put("作业波次", "");
            }
            
            row.put("当前电量", task.getCurrentSoc() + "%");
            row.put("目标电量", task.getTargetSoc() + "%");
            row.put("分配操作员", task.getAssignedOperator());
            row.put("创建人", task.getCreatedBy());
            row.put("创建时间", task.getCreatedAt());
            row.put("开始充电时间", task.getActualStartTime());
            row.put("完成时间", task.getActualEndTime());
            row.put("备注", task.getRemarks());
            
            result.add(row);
        }
        
        return result;
    }
}
