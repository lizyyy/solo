package com.migration.dualwrite.service;

import com.migration.dualwrite.dto.DataSourceConfig;
import com.migration.dualwrite.dto.MigrationField;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.dto.WriteResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class DualWriteService {

    @Value("${dualwrite.simulate-delay-ms:50}")
    private long simulateDelayMs;

    @Value("${dualwrite.old-failure-rate:0}")
    private double oldFailureRate;

    @Value("${dualwrite.new-failure-rate:0}")
    private double newFailureRate;

    private final Map<String, Map<String, Object>> oldDatabase = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> newDatabase = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public WriteResult executeWrite(MigrationTask task, boolean isOld) {
        long startTime = System.currentTimeMillis();
        WriteResult result = new WriteResult();
        result.setWriteTime(LocalDateTime.now());

        try {
            simulateDelay();

            double failureRate = isOld ? oldFailureRate : newFailureRate;
            if (random.nextDouble() < failureRate) {
                throw new RuntimeException("模拟写入失败: " + (isOld ? "旧库" : "新库") + "连接超时");
            }

            DataSourceConfig dataSource = isOld ? task.getOldDataSource() : task.getNewDataSource();
            Map<String, Object> writeData = new HashMap<>(task.getWriteData());

            log.info("执行写入操作: 数据源={}, 表名={}, 数据={}", 
                    isOld ? "旧库" : "新库", dataSource.getTableName(), writeData.keySet());

            applyMigrationTransformations(writeData, task.getFields(), isOld);

            String primaryKey = extractPrimaryKeyValue(writeData, task.getFields());
            result.setPrimaryKeyValue(primaryKey);

            Map<String, Object> database = isOld ? oldDatabase : newDatabase;
            String tableKey = dataSource.getTableName() + "_" + primaryKey;
            database.put(tableKey, new HashMap<>(writeData));

            result.setSuccess(true);
            result.setWrittenData(writeData);
            result.setAffectedRows(1);

            log.info("写入成功: 表={}, 主键={}", dataSource.getTableName(), primaryKey);

        } catch (Exception e) {
            log.error("写入失败", e);
            result.setSuccess(false);
            result.setErrorCode("WRITE_ERROR");
            result.setErrorMessage(e.getMessage());
        }

        result.setCostMs(System.currentTimeMillis() - startTime);
        return result;
    }

    private void applyMigrationTransformations(Map<String, Object> data, 
                                                List<MigrationField> fields, 
                                                boolean isOld) {
        if (isOld) {
            return;
        }

        for (MigrationField field : fields) {
            Object value = data.get(field.getFieldName());
            if (value == null) {
                continue;
            }

            if (field.getNewColumnName() != null && !field.getNewColumnName().equals(field.getFieldName())) {
                data.remove(field.getFieldName());
                data.put(field.getNewColumnName(), value);
            }

            if ("amount".equals(field.getFieldName()) && value instanceof Number) {
                double original = ((Number) value).doubleValue();
                if (random.nextDouble() < 0.1) {
                    BigDecimal transformed = BigDecimal.valueOf(original)
                            .multiply(BigDecimal.valueOf(1.0 + (random.nextDouble() * 0.001 - 0.0005)));
                    data.put(field.getFieldName(), transformed);
                    log.debug("金额字段精度转换: 原始={}, 转换后={}", original, transformed);
                }
            }

            if ("status".equals(field.getFieldName()) && value instanceof String) {
                try {
                    data.put(field.getFieldName(), Integer.parseInt((String) value));
                } catch (NumberFormatException e) {
                }
            }
        }
    }

    private void simulateDelay() {
        if (simulateDelayMs > 0) {
            try {
                long delay = simulateDelayMs + (long) (random.nextGaussian() * simulateDelayMs * 0.3);
                Thread.sleep(Math.max(0, delay));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private String extractPrimaryKeyValue(Map<String, Object> data, List<MigrationField> fields) {
        for (MigrationField field : fields) {
            if (field.isPrimaryKey()) {
                Object value = data.get(field.getFieldName());
                if (value == null) {
                    value = data.get(field.getNewColumnName());
                }
                return value != null ? value.toString() : "default_" + System.currentTimeMillis();
            }
        }
        return "key_" + System.currentTimeMillis();
    }

    public Map<String, Object> getFromOldDatabase(String tableName, String primaryKey) {
        return oldDatabase.get(tableName + "_" + primaryKey);
    }

    public Map<String, Object> getFromNewDatabase(String tableName, String primaryKey) {
        return newDatabase.get(tableName + "_" + primaryKey);
    }

    public void clearDatabases() {
        oldDatabase.clear();
        newDatabase.clear();
        log.info("模拟数据库已清空");
    }

    public int getOldDatabaseSize() {
        return oldDatabase.size();
    }

    public int getNewDatabaseSize() {
        return newDatabase.size();
    }
}
