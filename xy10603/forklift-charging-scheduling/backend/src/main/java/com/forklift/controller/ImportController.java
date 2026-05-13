package com.forklift.controller;

import cn.hutool.core.util.IdUtil;
import com.forklift.common.Result;
import com.forklift.entity.*;
import com.forklift.entity.ImportBatch;
import com.forklift.mapper.ImportBatchMapper;
import com.forklift.service.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/import")
public class ImportController {

    @Autowired
    private BatteryService batteryService;

    @Autowired
    private WorkWaveService waveService;

    @Autowired
    private ImportBatchMapper importBatchMapper;

    @PostMapping("/batteries")
    public Result<Map<String, Object>> importBatteries(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failCount = 0;
        List<String> errors = new ArrayList<>();
        
        ImportBatch batch = new ImportBatch();
        batch.setBatchCode("IB-" + IdUtil.getSnowflakeNextIdStr());
        batch.setFileName(file.getOriginalFilename());
        batch.setFileType("XLSX");
        batch.setStatus("PROCESSING");
        batch.setCreatedAt(LocalDateTime.now());
        batch.setCreatedBy(operator);
        
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int totalRecords = sheet.getLastRowNum();
            batch.setTotalRecords(totalRecords);
            
            for (int i = 1; i <= totalRecords; i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                
                try {
                    String batteryCode = getCellValue(row.getCell(0));
                    String forkliftCode = getCellValue(row.getCell(1));
                    String batteryType = getCellValue(row.getCell(2));
                    String capacityStr = getCellValue(row.getCell(3));
                    String socStr = getCellValue(row.getCell(4));
                    String healthStatus = getCellValue(row.getCell(5));
                    String healthScoreStr = getCellValue(row.getCell(6));
                    
                    if (batteryCode.isEmpty()) {
                        throw new RuntimeException("电池编号不能为空");
                    }
                    
                    Battery existing = batteryService.getByBatteryCode(batteryCode);
                    if (existing != null) {
                        throw new RuntimeException("电池编号已存在: " + batteryCode);
                    }
                    
                    Battery battery = new Battery();
                    battery.setBatteryCode(batteryCode);
                    battery.setForkliftCode(forkliftCode);
                    if (!batteryType.isEmpty()) {
                        battery.setBatteryType(batteryType);
                    }
                    if (!capacityStr.isEmpty()) {
                        battery.setCapacityKwh(new java.math.BigDecimal(capacityStr));
                    }
                    if (!socStr.isEmpty()) {
                        battery.setCurrentSoc(Integer.parseInt(socStr));
                    }
                    if (!healthStatus.isEmpty()) {
                        battery.setHealthStatus(healthStatus);
                    }
                    if (!healthScoreStr.isEmpty()) {
                        battery.setHealthScore(Integer.parseInt(healthScoreStr));
                    }
                    
                    batteryService.create(battery);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "行: " + e.getMessage());
                }
            }
            
            batch.setSuccessCount(successCount);
            batch.setFailCount(failCount);
            batch.setStatus(errors.isEmpty() ? "COMPLETED" : "PARTIAL");
            batch.setErrorLog(String.join("\n", errors));
            importBatchMapper.insert(batch);
            
        } catch (Exception e) {
            batch.setStatus("FAILED");
            batch.setErrorLog(e.getMessage());
            importBatchMapper.insert(batch);
            throw new RuntimeException("导入失败: " + e.getMessage());
        }
        
        result.put("batchCode", batch.getBatchCode());
        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("errors", errors);
        return Result.success(result);
    }

    @PostMapping("/waves")
    public Result<Map<String, Object>> importWaves(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Operator", defaultValue = "admin") String operator) {
        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failCount = 0;
        List<String> errors = new ArrayList<>();
        
        ImportBatch batch = new ImportBatch();
        batch.setBatchCode("IW-" + IdUtil.getSnowflakeNextIdStr());
        batch.setFileName(file.getOriginalFilename());
        batch.setFileType("XLSX");
        batch.setStatus("PROCESSING");
        batch.setCreatedAt(LocalDateTime.now());
        batch.setCreatedBy(operator);
        
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int totalRecords = sheet.getLastRowNum();
            batch.setTotalRecords(totalRecords);
            
            for (int i = 1; i <= totalRecords; i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                
                try {
                    String waveCode = getCellValue(row.getCell(0));
                    String waveName = getCellValue(row.getCell(1));
                    String startTimeStr = getCellValue(row.getCell(2));
                    String endTimeStr = getCellValue(row.getCell(3));
                    String priorityStr = getCellValue(row.getCell(4));
                    String requiredStr = getCellValue(row.getCell(5));
                    
                    if (waveCode.isEmpty() || waveName.isEmpty() || startTimeStr.isEmpty() || endTimeStr.isEmpty()) {
                        throw new RuntimeException("必填字段不能为空");
                    }
                    
                    WorkWave existing = waveService.getByWaveCode(waveCode);
                    if (existing != null) {
                        throw new RuntimeException("波次编号已存在: " + waveCode);
                    }
                    
                    WorkWave wave = new WorkWave();
                    wave.setWaveCode(waveCode);
                    wave.setWaveName(waveName);
                    wave.setStartTime(LocalDateTime.parse(startTimeStr));
                    wave.setEndTime(LocalDateTime.parse(endTimeStr));
                    if (!priorityStr.isEmpty()) {
                        wave.setPriority(Integer.parseInt(priorityStr));
                    }
                    if (!requiredStr.isEmpty()) {
                        wave.setRequiredForklifts(Integer.parseInt(requiredStr));
                    }
                    
                    waveService.create(wave);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    errors.add("第" + (i + 1) + "行: " + e.getMessage());
                }
            }
            
            batch.setSuccessCount(successCount);
            batch.setFailCount(failCount);
            batch.setStatus(errors.isEmpty() ? "COMPLETED" : "PARTIAL");
            batch.setErrorLog(String.join("\n", errors));
            importBatchMapper.insert(batch);
            
        } catch (Exception e) {
            batch.setStatus("FAILED");
            batch.setErrorLog(e.getMessage());
            importBatchMapper.insert(batch);
            throw new RuntimeException("导入失败: " + e.getMessage());
        }
        
        result.put("batchCode", batch.getBatchCode());
        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("errors", errors);
        return Result.success(result);
    }
    
    private String getCellValue(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return "";
        }
    }
}
