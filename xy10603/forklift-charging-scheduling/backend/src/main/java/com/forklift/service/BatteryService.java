package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.forklift.entity.Battery;
import com.forklift.mapper.BatteryMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class BatteryService {

    @Autowired
    private BatteryMapper batteryMapper;

    @Autowired
    private ChangeHistoryService changeHistoryService;

    public List<Battery> getAllBatteries() {
        return batteryMapper.selectList(null);
    }

    public Battery getById(Long id) {
        return batteryMapper.selectById(id);
    }

    public Battery getByBatteryCode(String batteryCode) {
        QueryWrapper<Battery> wrapper = new QueryWrapper<>();
        wrapper.eq("battery_code", batteryCode);
        return batteryMapper.selectOne(wrapper);
    }

    public List<Battery> getLowBatteries() {
        QueryWrapper<Battery> wrapper = new QueryWrapper<>();
        wrapper.eq("health_status", "GOOD")
               .lt("current_soc", 30)
               .orderByAsc("current_soc");
        return batteryMapper.selectList(wrapper);
    }

    public List<Battery> getLowHealthBatteries() {
        QueryWrapper<Battery> wrapper = new QueryWrapper<>();
        wrapper.lt("health_score", 70)
               .orderByAsc("health_score");
        return batteryMapper.selectList(wrapper);
    }

    @Transactional
    public Battery create(Battery battery) {
        if (battery.getCurrentSoc() == null) {
            battery.setCurrentSoc(80);
        }
        if (battery.getMinSoc() == null) {
            battery.setMinSoc(20);
        }
        if (battery.getHealthStatus() == null) {
            battery.setHealthStatus("GOOD");
        }
        if (battery.getHealthScore() == null) {
            battery.setHealthScore(95);
        }
        if (battery.getBatteryType() == null) {
            battery.setBatteryType("LITHIUM");
        }
        if (battery.getCapacityKwh() == null) {
            battery.setCapacityKwh(new BigDecimal("80.00"));
        }
        batteryMapper.insert(battery);
        return battery;
    }

    @Transactional
    public Battery update(Long id, Battery battery, String operator) {
        Battery oldBattery = batteryMapper.selectById(id);
        if (oldBattery == null) {
            throw new RuntimeException("电池不存在");
        }
        
        if (battery.getHealthStatus() != null && !battery.getHealthStatus().equals(oldBattery.getHealthStatus())) {
            changeHistoryService.recordChange("BATTERY", id, "healthStatus", 
                oldBattery.getHealthStatus(), battery.getHealthStatus(), "UPDATE", operator, 
                "电池健康状态变更");
        }
        
        if (battery.getHealthScore() != null && !battery.getHealthScore().equals(oldBattery.getHealthScore())) {
            changeHistoryService.recordChange("BATTERY", id, "healthScore", 
                oldBattery.getHealthScore(), battery.getHealthScore(), "UPDATE", operator, 
                "电池健康分数变更");
        }

        if (battery.getCurrentSoc() != null && !battery.getCurrentSoc().equals(oldBattery.getCurrentSoc())) {
            changeHistoryService.recordChange("BATTERY", id, "currentSoc", 
                oldBattery.getCurrentSoc(), battery.getCurrentSoc(), "UPDATE", operator, 
                "电池电量变更");
        }

        battery.setId(id);
        batteryMapper.updateById(battery);
        return batteryMapper.selectById(id);
    }

    @Transactional
    public void updateSoc(Long id, Integer newSoc, String operator) {
        Battery battery = batteryMapper.selectById(id);
        if (battery == null) {
            throw new RuntimeException("电池不存在");
        }

        Integer oldSoc = battery.getCurrentSoc();
        UpdateWrapper<Battery> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id)
               .set("current_soc", newSoc)
               .set("updated_at", LocalDateTime.now());
        batteryMapper.update(null, wrapper);
        
        changeHistoryService.recordChange("BATTERY", id, "currentSoc", 
            oldSoc, newSoc, "UPDATE_SOC", operator, "充电/放电更新电量");
    }

    @Transactional
    public void updateHealthStatus(Long id, String status, Integer score, String operator, String reason) {
        Battery battery = batteryMapper.selectById(id);
        if (battery == null) {
            throw new RuntimeException("电池不存在");
        }

        String oldStatus = battery.getHealthStatus();
        Integer oldScore = battery.getHealthScore();

        UpdateWrapper<Battery> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", id);
        if (status != null) {
            wrapper.set("health_status", status);
        }
        if (score != null) {
            wrapper.set("health_score", score);
        }
        wrapper.set("updated_at", LocalDateTime.now());
        batteryMapper.update(null, wrapper);
        
        if (!oldStatus.equals(status)) {
            changeHistoryService.recordChange("BATTERY", id, "healthStatus", 
                oldStatus, status, "UPDATE_HEALTH", operator, reason);
        }
        if (score != null && !oldScore.equals(score)) {
            changeHistoryService.recordChange("BATTERY", id, "healthScore", 
                oldScore, score, "UPDATE_HEALTH", operator, reason);
        }
    }
}
