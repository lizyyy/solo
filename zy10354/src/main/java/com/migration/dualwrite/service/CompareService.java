package com.migration.dualwrite.service;

import com.migration.dualwrite.dto.FieldDiff;
import com.migration.dualwrite.dto.MigrationField;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.dto.WriteResult;
import com.migration.dualwrite.enums.DiffType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CompareService {

    public List<FieldDiff> compareResults(MigrationTask task) {
        List<FieldDiff> diffs = new ArrayList<>();

        WriteResult oldResult = task.getOldWriteResult();
        WriteResult newResult = task.getNewWriteResult();

        if (oldResult == null || !oldResult.getSuccess()) {
            log.warn("旧库写入结果为空或失败，跳过比对");
            return diffs;
        }

        if (newResult == null || !newResult.getSuccess()) {
            log.warn("新库写入结果为空或失败，跳过比对");
            return diffs;
        }

        Map<String, Object> oldData = oldResult.getWrittenData();
        Map<String, Object> newData = newResult.getWrittenData();

        for (MigrationField field : task.getFields()) {
            if (!field.isCompareEnable()) {
                log.debug("字段 {} 跳过比对", field.getFieldName());
                continue;
            }

            String oldKey = field.getOldColumnName() != null ? field.getOldColumnName() : field.getFieldName();
            String newKey = field.getNewColumnName() != null ? field.getNewColumnName() : field.getFieldName();

            Object oldValue = oldData.get(oldKey);
            Object newValue = newData.get(newKey);

            FieldDiff diff = compareField(field, oldValue, newValue);
            if (diff != null) {
                diffs.add(diff);
                log.info("发现差异: 字段={}, 类型={}, 旧值={}, 新值={}",
                        field.getFieldName(), diff.getDiffType(), oldValue, newValue);
            }
        }

        return diffs;
    }

    private FieldDiff compareField(MigrationField field, Object oldValue, Object newValue) {
        FieldDiff diff = null;

        if (oldValue == null && newValue == null) {
            return null;
        }

        if (oldValue == null || newValue == null) {
            diff = new FieldDiff();
            diff.setFieldName(field.getFieldName());
            diff.setDiffType(DiffType.NULL_VS_NON_NULL);
            diff.setOldValue(oldValue);
            diff.setNewValue(newValue);
            diff.setDescription("空值不一致: 旧=" + oldValue + ", 新=" + newValue);
            return diff;
        }

        if (!oldValue.getClass().equals(newValue.getClass())) {
            diff = new FieldDiff();
            diff.setFieldName(field.getFieldName());
            diff.setDiffType(DiffType.TYPE_MISMATCH);
            diff.setOldValue(oldValue);
            diff.setNewValue(newValue);
            diff.setOldValueType(oldValue.getClass().getSimpleName());
            diff.setNewValueType(newValue.getClass().getSimpleName());
            diff.setDescription("类型不一致: 旧=" + oldValue.getClass().getSimpleName() +
                    ", 新=" + newValue.getClass().getSimpleName());
            return diff;
        }

        if (field.getPrecisionThreshold() != null &&
                (oldValue instanceof Number || newValue instanceof Number)) {
            double oldNum = ((Number) oldValue).doubleValue();
            double newNum = ((Number) newValue).doubleValue();
            if (Math.abs(oldNum - newNum) > field.getPrecisionThreshold()) {
                diff = new FieldDiff();
                diff.setFieldName(field.getFieldName());
                diff.setDiffType(DiffType.PRECISION_MISMATCH);
                diff.setOldValue(oldValue);
                diff.setNewValue(newValue);
                diff.setDescription("精度超出阈值: 阈值=" + field.getPrecisionThreshold());
                return diff;
            }
            return null;
        }

        if (!ObjectUtils.nullSafeEquals(oldValue, newValue)) {
            diff = new FieldDiff();
            diff.setFieldName(field.getFieldName());
            diff.setDiffType(DiffType.VALUE_MISMATCH);
            diff.setOldValue(oldValue);
            diff.setNewValue(newValue);
            diff.setDescription("值不一致: 旧=" + oldValue + ", 新=" + newValue);
            return diff;
        }

        return null;
    }
}
