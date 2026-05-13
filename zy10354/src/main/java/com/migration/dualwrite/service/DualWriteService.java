package com.migration.dualwrite.service;

import com.migration.dualwrite.dto.DataSourceConfig;
import com.migration.dualwrite.dto.MigrationField;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.dto.WriteResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DualWriteService {

    public WriteResult executeWrite(MigrationTask task, boolean isOld) {
        long startTime = System.currentTimeMillis();
        WriteResult result = new WriteResult();
        result.setWriteTime(LocalDateTime.now());

        try {
            DataSourceConfig dataSource = isOld ? task.getOldDataSource() : task.getNewDataSource();
            Map<String, Object> writeData = task.getWriteData();

            log.info("执行写入操作: 数据源={}, 表名={}", isOld ? "旧库" : "新库", dataSource.getTableName());

            Map<String, Object> writtenData = simulateWrite(dataSource, writeData, task.getFields());

            result.setSuccess(true);
            result.setWrittenData(writtenData);
            result.setAffectedRows(1);
            result.setPrimaryKeyValue(extractPrimaryKeyValue(writtenData, task.getFields()));

            log.info("写入成功: 主键值={}", result.getPrimaryKeyValue());

        } catch (Exception e) {
            log.error("写入失败", e);
            result.setSuccess(false);
            result.setErrorCode("WRITE_ERROR");
            result.setErrorMessage(e.getMessage());
        }

        result.setCostMs(System.currentTimeMillis() - startTime);
        return result;
    }

    private Map<String, Object> simulateWrite(DataSourceConfig dataSource,
                                               Map<String, Object> writeData,
                                               List<MigrationField> fields) {
        Map<String, Object> result = new HashMap<>(writeData);

        for (MigrationField field : fields) {
            String columnName = field.getNewColumnName() != null ? field.getNewColumnName() : field.getFieldName();
            if (!result.containsKey(columnName) && writeData.containsKey(field.getFieldName())) {
                result.put(columnName, writeData.get(field.getFieldName()));
            }
        }

        return result;
    }

    private String extractPrimaryKeyValue(Map<String, Object> data, List<MigrationField> fields) {
        for (MigrationField field : fields) {
            if (field.isPrimaryKey()) {
                Object value = data.get(field.getFieldName());
                return value != null ? value.toString() : null;
            }
        }
        return null;
    }
}
