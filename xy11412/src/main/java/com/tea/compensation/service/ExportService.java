package com.tea.compensation.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.format.DateTimeFormat;
import com.tea.compensation.entity.CompensationTask;
import com.tea.compensation.entity.TaskItem;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.exception.BusinessException;
import com.tea.compensation.repository.CompensationTaskRepository;
import com.tea.compensation.repository.TaskItemRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final CompensationTaskRepository taskRepository;
    private final TaskItemRepository taskItemRepository;
    private final CompensationTaskService taskService;
    private final OperationLogService operationLogService;

    @Transactional
    public byte[] exportTask(Long taskId, String operator, String operatorName, String ipAddress) {
        log.info("导出任务数据，任务ID: {}, 操作人: {}", taskId, operator);

        CompensationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> BusinessException.of(404, "任务不存在"));

        if (!taskService.validateDataConsistency(taskId)) {
            throw BusinessException.of(500, "数据一致性校验失败，请联系管理员");
        }

        List<TaskItem> items = taskItemRepository.findByTaskId(taskId);

        List<TaskExportVO> exportData = items.stream()
                .map(item -> convertToExportVO(task, item))
                .collect(Collectors.toList());

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            EasyExcel.write(out, TaskExportVO.class)
                    .sheet("任务明细")
                    .doWrite(exportData);

            operationLogService.logExport(task, operator, operatorName, ipAddress);
            
            log.info("任务导出成功，批次号: {}", task.getBatchNo());
            return out.toByteArray();
        } catch (IOException e) {
            log.error("导出任务失败", e);
            throw BusinessException.of(500, "导出失败: " + e.getMessage());
        }
    }

    @Transactional
    public byte[] exportBatchTasks(List<Long> taskIds, String operator, String operatorName, String ipAddress) {
        log.info("批量导出任务数据，任务数量: {}, 操作人: {}", taskIds.size(), operator);

        List<TaskExportVO> allData = new ArrayList<>();

        for (Long taskId : taskIds) {
            if (!taskService.validateDataConsistency(taskId)) {
                log.warn("任务 {} 数据一致性校验失败，跳过导出", taskId);
                continue;
            }

            CompensationTask task = taskRepository.findById(taskId).orElse(null);
            if (task == null) {
                continue;
            }

            List<TaskItem> items = taskItemRepository.findByTaskId(taskId);
            allData.addAll(items.stream()
                    .map(item -> convertToExportVO(task, item))
                    .collect(Collectors.toList()));

            operationLogService.logExport(task, operator, operatorName, ipAddress);
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            EasyExcel.write(out, TaskExportVO.class)
                    .sheet("任务明细")
                    .doWrite(allData);

            log.info("批量导出成功，共导出 {} 条明细", allData.size());
            return out.toByteArray();
        } catch (IOException e) {
            log.error("批量导出失败", e);
            throw BusinessException.of(500, "导出失败: " + e.getMessage());
        }
    }

    private TaskExportVO convertToExportVO(CompensationTask task, TaskItem item) {
        TaskExportVO vo = new TaskExportVO();
        vo.setBatchNo(task.getBatchNo());
        vo.setStoreId(task.getStoreId());
        vo.setStoreName(task.getStoreName());
        vo.setTaskType(task.getTaskType().getDescription());
        vo.setItemNo(item.getItemNo());
        vo.setMaterialName(item.getMaterialName());
        vo.setMaterialCode(item.getMaterialCode());
        vo.setQuantity(item.getQuantity());
        vo.setUnit(item.getUnit());
        vo.setUnitPrice(item.getUnitPrice());
        vo.setAmount(item.getAmount());
        vo.setStatus(item.getStatus().getDescription());
        vo.setFailReason(item.getFailReason());
        vo.setExternalId(item.getExternalId());
        vo.setRemark(item.getRemark());
        vo.setSubmitter(task.getSubmitter());
        vo.setCreatedAt(item.getCreatedAt());
        return vo;
    }

    @Data
    public static class TaskExportVO {
        @ExcelProperty("批次号")
        private String batchNo;

        @ExcelProperty("门店ID")
        private String storeId;

        @ExcelProperty("门店名称")
        private String storeName;

        @ExcelProperty("任务类型")
        private String taskType;

        @ExcelProperty("明细编号")
        private String itemNo;

        @ExcelProperty("原料名称")
        private String materialName;

        @ExcelProperty("原料编码")
        private String materialCode;

        @ExcelProperty("数量")
        private BigDecimal quantity;

        @ExcelProperty("单位")
        private String unit;

        @ExcelProperty("单价")
        private BigDecimal unitPrice;

        @ExcelProperty("金额")
        private BigDecimal amount;

        @ExcelProperty("状态")
        private String status;

        @ExcelProperty("失败原因")
        private String failReason;

        @ExcelProperty("外部ID")
        private String externalId;

        @ExcelProperty("备注")
        private String remark;

        @ExcelProperty("提交人")
        private String submitter;

        @ExcelProperty("创建时间")
        @DateTimeFormat("yyyy-MM-dd HH:mm:ss")
        private LocalDateTime createdAt;
    }
}
