package com.forklift.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.forklift.entity.*;
import com.forklift.mapper.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ReportService {

    @Autowired
    private ChargingTaskMapper taskMapper;

    @Autowired
    private BatteryMapper batteryMapper;

    @Autowired
    private ChargingStationMapper stationMapper;

    @Autowired
    private WorkWaveMapper waveMapper;

    @Autowired
    private AnomalyRecordMapper anomalyMapper;

    @Autowired
    private ChangeHistoryMapper changeHistoryMapper;

    @Autowired
    private ImportBatchMapper importBatchMapper;

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        
        QueryWrapper<ChargingStation> stationWrapper;
        stationWrapper = new QueryWrapper<>();
        stats.put("totalStations", stationMapper.selectCount(stationWrapper));
        
        stationWrapper = new QueryWrapper<>();
        stationWrapper.eq("status", "AVAILABLE");
        stats.put("availableStations", stationMapper.selectCount(stationWrapper));
        
        stationWrapper = new QueryWrapper<>();
        stationWrapper.eq("status", "FAULTY");
        stats.put("faultyStations", stationMapper.selectCount(stationWrapper));
        
        QueryWrapper<Battery> batteryWrapper = new QueryWrapper<>();
        stats.put("totalBatteries", batteryMapper.selectCount(batteryWrapper));
        
        batteryWrapper = new QueryWrapper<>();
        batteryWrapper.lt("current_soc", 30);
        stats.put("lowBatteries", batteryMapper.selectCount(batteryWrapper));
        
        batteryWrapper = new QueryWrapper<>();
        batteryWrapper.lt("health_score", 70);
        stats.put("lowHealthBatteries", batteryMapper.selectCount(batteryWrapper));
        
        QueryWrapper<ChargingTask> taskWrapper;
        
        taskWrapper = new QueryWrapper<>();
        stats.put("totalTasks", taskMapper.selectCount(taskWrapper));
        
        taskWrapper = new QueryWrapper<>();
        taskWrapper.eq("status", "PENDING");
        stats.put("pendingTasks", taskMapper.selectCount(taskWrapper));
        
        taskWrapper = new QueryWrapper<>();
        taskWrapper.eq("status", "CHARGING");
        stats.put("chargingTasks", taskMapper.selectCount(taskWrapper));
        
        taskWrapper = new QueryWrapper<>();
        taskWrapper.eq("status", "COMPLETED");
        stats.put("completedTasks", taskMapper.selectCount(taskWrapper));
        
        taskWrapper = new QueryWrapper<>();
        taskWrapper.eq("is_urgent", true)
                   .in("status", "PENDING", "QUEUED");
        stats.put("urgentTasks", taskMapper.selectCount(taskWrapper));
        
        QueryWrapper<AnomalyRecord> anomalyWrapper;
        
        anomalyWrapper = new QueryWrapper<>();
        stats.put("totalAnomalies", anomalyMapper.selectCount(anomalyWrapper));
        
        anomalyWrapper = new QueryWrapper<>();
        anomalyWrapper.eq("status", "PENDING");
        stats.put("pendingAnomalies", anomalyMapper.selectCount(anomalyWrapper));
        
        anomalyWrapper = new QueryWrapper<>();
        anomalyWrapper.eq("status", "PENDING")
                     .eq("severity", "HIGH");
        stats.put("highPriorityAnomalies", anomalyMapper.selectCount(anomalyWrapper));
        
        QueryWrapper<WorkWave> waveWrapper = new QueryWrapper<>();
        waveWrapper.in("status", "PLANNED", "IN_PROGRESS");
        stats.put("activeWaves", waveMapper.selectCount(waveWrapper));
        
        return stats;
    }

    public List<Map<String, Object>> getChargeHistory(Map<String, Object> filters) {
        List<Map<String, Object>> result = new ArrayList<>();
        
        QueryWrapper<ChargingTask> wrapper = new QueryWrapper<>();
        
        if (filters.get("assignedOperator") != null && !filters.get("assignedOperator").toString().isEmpty()) {
            wrapper.eq("assigned_operator", filters.get("assignedOperator"));
        }
        if (filters.get("handledBy") != null && !filters.get("handledBy").toString().isEmpty()) {
            wrapper.eq("created_by", filters.get("handledBy"));
        }
        if (filters.get("startTime") != null && filters.get("endTime") != null) {
            wrapper.between("created_at", 
                LocalDateTime.parse(filters.get("startTime").toString()),
                LocalDateTime.parse(filters.get("endTime").toString()));
        }
        if (filters.get("taskStatus") != null && !filters.get("taskStatus").toString().isEmpty()) {
            wrapper.eq("status", filters.get("taskStatus"));
        }
        
        wrapper.orderByDesc("created_at");
        
        List<ChargingTask> tasks = taskMapper.selectList(wrapper);
        
        for (ChargingTask task : tasks) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", task.getId());
            row.put("taskCode", task.getTaskCode());
            row.put("status", task.getStatus());
            row.put("priority", task.getPriority());
            row.put("isUrgent", task.getIsUrgent());
            
            if (task.getBatteryId() != null) {
                Battery battery = batteryMapper.selectById(task.getBatteryId());
                if (battery != null) {
                    row.put("batteryCode", battery.getBatteryCode());
                    row.put("forkliftCode", battery.getForkliftCode());
                    row.put("healthStatus", battery.getHealthStatus());
                }
            }
            
            if (task.getStationId() != null) {
                ChargingStation station = stationMapper.selectById(task.getStationId());
                if (station != null) {
                    row.put("stationCode", station.getStationCode());
                }
            }
            
            if (task.getWaveId() != null) {
                WorkWave wave = waveMapper.selectById(task.getWaveId());
                if (wave != null) {
                    row.put("waveName", wave.getWaveName());
                }
            }
            
            row.put("currentSoc", task.getCurrentSoc());
            row.put("targetSoc", task.getTargetSoc());
            row.put("assignedOperator", task.getAssignedOperator());
            row.put("createdBy", task.getCreatedBy());
            row.put("createdAt", task.getCreatedAt());
            row.put("actualStartTime", task.getActualStartTime());
            row.put("actualEndTime", task.getActualEndTime());
            
            result.add(row);
        }
        
        return result;
    }

    public byte[] exportToExcel(Map<String, Object> filters) throws Exception {
        List<Map<String, Object>> data = getChargeHistory(filters);
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("充电记录报表");
            
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            
            String[] headers = {"任务编号", "状态", "优先级", "是否紧急", 
                "电池编号", "叉车编号", "电池健康状态", "充电桩编号", 
                "作业波次", "当前电量", "目标电量", "分配操作员", 
                "创建人", "创建时间", "开始充电时间", "完成时间"};
            
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            int rowNum = 1;
            for (Map<String, Object> row : data) {
                Row dataRow = sheet.createRow(rowNum++);
                int colNum = 0;
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("taskCode")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("status")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("priority")));
                dataRow.createCell(colNum++).setCellValue(Boolean.TRUE.equals(row.get("isUrgent")) ? "是" : "否");
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("batteryCode")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("forkliftCode")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("healthStatus")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("stationCode")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("waveName")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("currentSoc")) + "%");
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("targetSoc")) + "%");
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("assignedOperator")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("createdBy")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("createdAt")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("actualStartTime")));
                dataRow.createCell(colNum++).setCellValue(getStringValue(row.get("actualEndTime")));
            }
            
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }
    
    private String getStringValue(Object value) {
        return value != null ? value.toString() : "";
    }

    public List<Map<String, Object>> getImportHistory() {
        List<Map<String, Object>> result = new ArrayList<>();
        
        QueryWrapper<ImportBatch> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("created_at");
        List<ImportBatch> batches = importBatchMapper.selectList(wrapper);
        
        for (ImportBatch batch : batches) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", batch.getId());
            row.put("batchCode", batch.getBatchCode());
            row.put("fileName", batch.getFileName());
            row.put("fileType", batch.getFileType());
            row.put("totalRecords", batch.getTotalRecords());
            row.put("successCount", batch.getSuccessCount());
            row.put("failCount", batch.getFailCount());
            row.put("status", batch.getStatus());
            row.put("createdAt", batch.getCreatedAt());
            row.put("createdBy", batch.getCreatedBy());
            result.add(row);
        }
        
        return result;
    }

    public List<ChangeHistory> getChangeHistory(Map<String, Object> filters) {
        QueryWrapper<ChangeHistory> wrapper = new QueryWrapper<>();
        
        if (filters.get("entityType") != null && !filters.get("entityType").toString().isEmpty()) {
            wrapper.eq("entity_type", filters.get("entityType"));
        }
        if (filters.get("operator") != null && !filters.get("operator").toString().isEmpty()) {
            wrapper.eq("operator", filters.get("operator"));
        }
        if (filters.get("startTime") != null && filters.get("endTime") != null) {
            wrapper.between("created_at", 
                LocalDateTime.parse(filters.get("startTime").toString()),
                LocalDateTime.parse(filters.get("endTime").toString()));
        }
        
        wrapper.orderByDesc("created_at");
        return changeHistoryMapper.selectList(wrapper);
    }
}
