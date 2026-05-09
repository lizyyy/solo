package com.mold.service.service;

import com.mold.service.common.BusinessException;
import com.mold.service.domain.entity.*;
import com.mold.service.domain.repository.MoldChangeTaskRepository;
import com.mold.service.domain.repository.MoldRepository;
import com.mold.service.domain.repository.ProductionScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MoldLifeService {
    
    private final MoldRepository moldRepository;
    private final MoldChangeTaskRepository taskRepository;
    private final ProductionScheduleRepository scheduleRepository;
    private final OperationHistoryService historyService;
    
    @Transactional
    public void checkMoldLifeAndCreateTask(Mold mold, StrokeRecord record, String operator) {
        Long currentStrokes = mold.getTotalStrokes();
        Long warningThreshold = mold.getWarningThreshold();
        Long lifeThreshold = mold.getLifeThreshold();
        
        log.debug("检查模具寿命: 模具={}, 当前次数={}, 预警阈值={}, 寿命阈值={}",
                mold.getMoldCode(), currentStrokes, warningThreshold, lifeThreshold);
        
        LifeStatus lifeStatus = determineLifeStatus(currentStrokes, warningThreshold, lifeThreshold);
        
        boolean statusChanged = updateMoldStatus(mold, lifeStatus, operator);
        
        if (shouldCreateTask(lifeStatus, mold)) {
            createOrUpdateChangeTask(mold, record, lifeStatus, operator);
        }
        
        checkScheduleImpact(mold, operator);
    }
    
    private LifeStatus determineLifeStatus(Long currentStrokes, Long warningThreshold, Long lifeThreshold) {
        if (currentStrokes >= lifeThreshold) {
            return LifeStatus.EXPIRED;
        } else if (currentStrokes >= warningThreshold) {
            return LifeStatus.WARNING;
        } else if (currentStrokes >= warningThreshold * 0.8) {
            return LifeStatus.APPROACHING;
        }
        return LifeStatus.NORMAL;
    }
    
    private boolean updateMoldStatus(Mold mold, LifeStatus lifeStatus, String operator) {
        Mold.MoldStatus oldStatus = mold.getStatus();
        Mold.MoldStatus newStatus = oldStatus;
        
        switch (lifeStatus) {
            case EXPIRED:
                if (oldStatus != Mold.MoldStatus.EXPIRED && oldStatus != Mold.MoldStatus.UNDER_MAINTENANCE) {
                    newStatus = Mold.MoldStatus.EXPIRED;
                }
                break;
            case WARNING:
                if (oldStatus == Mold.MoldStatus.IN_USE || oldStatus == Mold.MoldStatus.AVAILABLE) {
                    newStatus = Mold.MoldStatus.WARNING;
                }
                break;
            default:
                if (oldStatus == Mold.MoldStatus.WARNING) {
                    newStatus = Mold.MoldStatus.IN_USE;
                }
        }
        
        if (oldStatus != newStatus) {
            mold.setStatus(newStatus);
            mold.setUpdatedBy(operator);
            moldRepository.save(mold);
            
            historyService.recordSimpleHistory(
                    "Mold", mold.getId(), mold.getMoldCode(),
                    OperationHistory.OperationType.STATUS_CHANGE,
                    String.format("状态变更: %s -> %s, 当前次数=%d, 阈值=%d",
                            oldStatus, newStatus, mold.getTotalStrokes(), mold.getLifeThreshold()),
                    "寿命状态自动变更", "SYSTEM", "system"
            );
            
            log.info("模具状态变更: 模具={}, 原状态={}, 新状态={}, 当前次数={}",
                    mold.getMoldCode(), oldStatus, newStatus, mold.getTotalStrokes());
            return true;
        }
        return false;
    }
    
    private boolean shouldCreateTask(LifeStatus lifeStatus, Mold mold) {
        if (lifeStatus == LifeStatus.NORMAL || lifeStatus == LifeStatus.APPROACHING) {
            return false;
        }
        
        List<MoldChangeTask> activeTasks = taskRepository.findActiveTasksByMoldId(mold.getId());
        if (!activeTasks.isEmpty()) {
            log.info("模具 {} 已有活跃的换模任务，跳过创建", mold.getMoldCode());
            return false;
        }
        
        return true;
    }
    
    @Transactional
    public MoldChangeTask createOrUpdateChangeTask(Mold mold, StrokeRecord record, 
                                                    LifeStatus lifeStatus, String operator) {
        MoldChangeTask.TaskType taskType = lifeStatus == LifeStatus.EXPIRED 
                ? MoldChangeTask.TaskType.LIFE_EXPIRED 
                : MoldChangeTask.TaskType.WARNING_PREVENTIVE;
        
        MoldChangeTask.TaskPriority priority = lifeStatus == LifeStatus.EXPIRED
                ? MoldChangeTask.TaskPriority.URGENT
                : MoldChangeTask.TaskPriority.HIGH;
        
        String taskNo = generateTaskNo();
        
        MoldChangeTask task = new MoldChangeTask();
        task.setTaskNo(taskNo);
        task.setMoldId(mold.getId());
        task.setMoldCode(mold.getMoldCode());
        task.setMoldName(mold.getMoldName());
        task.setTaskType(taskType);
        task.setStatus(MoldChangeTask.TaskStatus.PENDING);
        task.setPriority(priority);
        task.setTriggeredStrokes(mold.getTotalStrokes());
        task.setLifeThreshold(mold.getLifeThreshold());
        task.setProductionLine(mold.getProductionLine());
        task.setCurrentProduct(mold.getCurrentProduct());
        task.setExpectedCompleteTime(LocalDateTime.now().plusHours(lifeStatus == LifeStatus.EXPIRED ? 2 : 24));
        task.setRelatedStrokeRecordId(record != null ? record.getId() : null);
        task.setCreatedBy(operator);
        task.setUpdatedBy(operator);
        
        String scheduleImpact = analyzeScheduleImpact(mold);
        task.setScheduleImpact(scheduleImpact);
        
        taskRepository.save(task);
        
        historyService.recordSimpleHistory(
                "MoldChangeTask", task.getId(), task.getTaskNo(),
                OperationHistory.OperationType.CREATE,
                String.format("创建换模任务: 类型=%s, 优先级=%s, 触发次数=%d, 阈值=%d, 排程影响=%s",
                        taskType, priority, mold.getTotalStrokes(), mold.getLifeThreshold(), scheduleImpact),
                lifeStatus == LifeStatus.EXPIRED ? "模具寿命到期自动触发" : "模具预警自动触发",
                "SYSTEM", "system"
        );
        
        log.info("换模任务创建成功: 任务号={}, 模具={}, 类型={}, 优先级={}",
                taskNo, mold.getMoldCode(), taskType, priority);
        
        return task;
    }
    
    private String analyzeScheduleImpact(Mold mold) {
        if (mold.getProductionLine() == null) {
            return "无关联产线";
        }
        
        List<ProductionSchedule> activeSchedules = scheduleRepository.findActiveSchedulesByLine(mold.getProductionLine());
        if (activeSchedules.isEmpty()) {
            return "当前产线无活跃排程";
        }
        
        StringBuilder impact = new StringBuilder();
        long affectedCount = 0;
        
        for (ProductionSchedule schedule : activeSchedules) {
            if (mold.getId().equals(schedule.getMoldId())) {
                affectedCount++;
                if (schedule.getStatus() == ProductionSchedule.ScheduleStatus.IN_PROGRESS) {
                    impact.append("影响进行中排程:").append(schedule.getScheduleNo()).append(";");
                } else {
                    impact.append("影响待执行排程:").append(schedule.getScheduleNo()).append(";");
                }
            }
        }
        
        if (affectedCount == 0) {
            return "当前活跃排程不受影响";
        }
        
        return "影响 " + affectedCount + " 个排程:" + impact.toString();
    }
    
    @Transactional
    public void checkScheduleImpact(Mold mold, String operator) {
        if (mold.getProductionLine() == null) {
            return;
        }
        
        List<ProductionSchedule> schedules = scheduleRepository.findByMoldIdAndStatusIn(
                mold.getId(),
                List.of(ProductionSchedule.ScheduleStatus.PLANNED, 
                        ProductionSchedule.ScheduleStatus.READY,
                        ProductionSchedule.ScheduleStatus.IN_PROGRESS)
        );
        
        LifeStatus lifeStatus = determineLifeStatus(
                mold.getTotalStrokes(), 
                mold.getWarningThreshold(), 
                mold.getLifeThreshold()
        );
        
        for (ProductionSchedule schedule : schedules) {
            ProductionSchedule.ImpactStatus oldImpact = schedule.getMoldImpactStatus();
            ProductionSchedule.ImpactStatus newImpact = calculateScheduleImpactStatus(lifeStatus, schedule);
            
            if (oldImpact != newImpact) {
                schedule.setMoldImpactStatus(newImpact);
                schedule.setMoldImpactDetail(generateImpactDetail(mold, schedule, lifeStatus));
                schedule.setUpdatedBy(operator);
                scheduleRepository.save(schedule);
                
                log.info("排程 {} 模具影响状态变更: {} -> {}", 
                        schedule.getScheduleNo(), oldImpact, newImpact);
            }
        }
    }
    
    private ProductionSchedule.ImpactStatus calculateScheduleImpactStatus(
            LifeStatus lifeStatus, ProductionSchedule schedule) {
        switch (lifeStatus) {
            case EXPIRED:
                return ProductionSchedule.ImpactStatus.NEEDS_MOLD_CHANGE;
            case WARNING:
                if (schedule.getStatus() == ProductionSchedule.ScheduleStatus.IN_PROGRESS) {
                    return ProductionSchedule.ImpactStatus.AT_RISK;
                }
                return ProductionSchedule.ImpactStatus.WARNING;
            case APPROACHING:
                return ProductionSchedule.ImpactStatus.WARNING;
            default:
                return ProductionSchedule.ImpactStatus.NORMAL;
        }
    }
    
    private String generateImpactDetail(Mold mold, ProductionSchedule schedule, LifeStatus lifeStatus) {
        long remaining = mold.getLifeThreshold() - mold.getTotalStrokes();
        return String.format("模具=%s, 当前次数=%d, 寿命阈值=%d, 剩余可用=%d次, 状态=%s, 排程计划数量=%d",
                mold.getMoldCode(), mold.getTotalStrokes(), mold.getLifeThreshold(),
                Math.max(0, remaining), lifeStatus, schedule.getPlannedQuantity());
    }
    
    private String generateTaskNo() {
        return "MCT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", (int) (Math.random() * 10000));
    }
    
    public enum LifeStatus {
        NORMAL,
        APPROACHING,
        WARNING,
        EXPIRED
    }
    
    @Transactional
    public void completeTask(String taskNo, String operator, String remark) {
        MoldChangeTask task = taskRepository.findByTaskNo(taskNo)
                .orElseThrow(() -> new BusinessException("任务不存在: " + taskNo));
        
        if (task.getStatus() == MoldChangeTask.TaskStatus.COMPLETED) {
            return;
        }
        
        Mold.MoldStatus oldMoldStatus = null;
        Mold.MoldStatus newMoldStatus = null;
        
        if (task.getTaskType() == MoldChangeTask.TaskType.LIFE_EXPIRED ||
            task.getTaskType() == MoldChangeTask.TaskType.WARNING_PREVENTIVE) {
            Mold mold = moldRepository.findById(task.getMoldId())
                    .orElseThrow(() -> new BusinessException("模具不存在"));
            
            oldMoldStatus = mold.getStatus();
            mold.setStatus(Mold.MoldStatus.UNDER_MAINTENANCE);
            mold.setLastMaintenanceDate(LocalDateTime.now());
            mold.setUpdatedBy(operator);
            moldRepository.save(mold);
            newMoldStatus = mold.getStatus();
        }
        
        task.setStatus(MoldChangeTask.TaskStatus.COMPLETED);
        task.setActualCompleteTime(LocalDateTime.now());
        task.setOperator(operator);
        task.setRemark(remark);
        task.setUpdatedBy(operator);
        taskRepository.save(task);
        
        String detail = String.format("任务完成: 类型=%s, 完成时间=%s", 
                task.getTaskType(), LocalDateTime.now());
        if (oldMoldStatus != null && newMoldStatus != null) {
            detail += String.format(", 模具状态: %s -> %s", oldMoldStatus, newMoldStatus);
        }
        
        historyService.recordSimpleHistory(
                "MoldChangeTask", task.getId(), task.getTaskNo(),
                OperationHistory.OperationType.COMPLETE,
                detail,
                remark, operator, "maintenance"
        );
        
        log.info("换模任务完成: 任务号={}, 操作员={}", taskNo, operator);
    }
}
