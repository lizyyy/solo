package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.forklift.entity.WorkWave;
import com.forklift.mapper.WorkWaveMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class WorkWaveService {

    @Autowired
    private WorkWaveMapper workWaveMapper;

    @Autowired
    private ChangeHistoryService changeHistoryService;

    public List<WorkWave> getAllWaves() {
        QueryWrapper<WorkWave> wrapper = new QueryWrapper<>();
        wrapper.orderByAsc("start_time");
        return workWaveMapper.selectList(wrapper);
    }

    public List<WorkWave> getActiveWaves() {
        LocalDateTime now = LocalDateTime.now();
        QueryWrapper<WorkWave> wrapper = new QueryWrapper<>();
        wrapper.in("status", "PLANNED", "IN_PROGRESS")
               .orderByAsc("priority")
               .orderByAsc("start_time");
        return workWaveMapper.selectList(wrapper);
    }

    public WorkWave getById(Long id) {
        return workWaveMapper.selectById(id);
    }

    public WorkWave getByWaveCode(String waveCode) {
        QueryWrapper<WorkWave> wrapper = new QueryWrapper<>();
        wrapper.eq("wave_code", waveCode);
        return workWaveMapper.selectOne(wrapper);
    }

    public List<WorkWave> getWavesForValidation(LocalDateTime time) {
        QueryWrapper<WorkWave> wrapper = new QueryWrapper<>();
        wrapper.le("start_time", time)
               .ge("end_time", time);
        return workWaveMapper.selectList(wrapper);
    }

    @Transactional
    public WorkWave create(WorkWave wave) {
        if (wave.getPriority() == null) {
            wave.setPriority(5);
        }
        if (wave.getStatus() == null) {
            wave.setStatus("PLANNED");
        }
        if (wave.getRequiredForklifts() == null) {
            wave.setRequiredForklifts(5);
        }
        workWaveMapper.insert(wave);
        return wave;
    }

    @Transactional
    public WorkWave update(Long id, WorkWave wave, String operator) {
        WorkWave oldWave = workWaveMapper.selectById(id);
        if (oldWave == null) {
            throw new RuntimeException("作业波次不存在");
        }
        
        if (wave.getStatus() != null && !wave.getStatus().equals(oldWave.getStatus())) {
            changeHistoryService.recordChange("WORK_WAVE", id, "status", 
                oldWave.getStatus(), wave.getStatus(), "UPDATE", operator, 
                "作业波次状态变更");
        }
        
        if (wave.getPriority() != null && !wave.getPriority().equals(oldWave.getPriority())) {
            changeHistoryService.recordChange("WORK_WAVE", id, "priority", 
                oldWave.getPriority(), wave.getPriority(), "UPDATE", operator, 
                "作业波次优先级变更");
        }

        if (wave.getStartTime() != null && !wave.getStartTime().equals(oldWave.getStartTime())) {
            changeHistoryService.recordChange("WORK_WAVE", id, "startTime", 
                oldWave.getStartTime(), wave.getStartTime(), "UPDATE", operator, 
                "作业波次开始时间变更");
        }

        if (wave.getEndTime() != null && !wave.getEndTime().equals(oldWave.getEndTime())) {
            changeHistoryService.recordChange("WORK_WAVE", id, "endTime", 
                oldWave.getEndTime(), wave.getEndTime(), "UPDATE", operator, 
                "作业波次结束时间变更");
        }

        wave.setId(id);
        workWaveMapper.updateById(wave);
        return workWaveMapper.selectById(id);
    }

    @Transactional
    public void updateStatus(Long id, String status, String operator, String reason) {
        WorkWave wave = workWaveMapper.selectById(id);
        if (wave == null) {
            throw new RuntimeException("作业波次不存在");
        }

        String oldStatus = wave.getStatus();
        UpdateWrapper<WorkWave> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id)
               .set("status", status)
               .set("updated_at", LocalDateTime.now());
        workWaveMapper.update(null, wrapper);
        
        changeHistoryService.recordChange("WORK_WAVE", id, "status", 
            oldStatus, status, "UPDATE_STATUS", operator, reason);
    }

    @Transactional
    public void incrementActualForklifts(Long waveId) {
        WorkWave wave = workWaveMapper.selectById(waveId);
        if (wave != null && wave.getActualForklifts() < wave.getRequiredForklifts()) {
            UpdateWrapper<WorkWave> wrapper = new UpdateWrapper<>();
            wrapper.eq("id", waveId)
                   .setSql("actual_forklifts = actual_forklifts + 1");
            workWaveMapper.update(null, wrapper);
        }
    }

    public boolean validateWaveForTask(Long waveId, LocalDateTime taskTime) {
        if (waveId == null) {
            return true;
        }
        WorkWave wave = workWaveMapper.selectById(waveId);
        if (wave == null) {
            return false;
        }
        if (!"PLANNED".equals(wave.getStatus()) && !"IN_PROGRESS".equals(wave.getStatus())) {
            return false;
        }
        if (taskTime.isBefore(wave.getStartTime()) || taskTime.isAfter(wave.getEndTime())) {
            return false;
        }
        return true;
    }
}
