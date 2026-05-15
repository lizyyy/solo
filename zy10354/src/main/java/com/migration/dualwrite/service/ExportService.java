package com.migration.dualwrite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.migration.dualwrite.dto.FieldDiff;
import com.migration.dualwrite.dto.MigrationTask;
import com.opencsv.CSVWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class ExportService {

    private final ObjectMapper objectMapper;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ExportService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public String exportTaskAsJson(MigrationTask task) {
        try {
            return objectMapper.writeValueAsString(task);
        } catch (Exception e) {
            log.error("导出任务为JSON失败: taskId={}", task.getTaskId(), e);
            return "{}";
        }
    }

    public String exportAllTasksAsJson(List<MigrationTask> tasks) {
        try {
            return objectMapper.writeValueAsString(tasks);
        } catch (Exception e) {
            log.error("导出所有任务为JSON失败", e);
            return "[]";
        }
    }

    public byte[] exportTaskAsCsv(MigrationTask task) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             OutputStreamWriter osw = new OutputStreamWriter(baos, StandardCharsets.UTF_8);
             CSVWriter writer = new CSVWriter(osw)) {

            String[] header = {
                    "任务ID", "接口名称", "业务主键", "状态", "创建时间", "更新时间",
                    "创建人", "备注", "差异数量", "比对通过", "切换结论"
            };
            writer.writeNext(header);

            String[] data = {
                    task.getTaskId(),
                    task.getInterfaceName(),
                    task.getBusinessKey(),
                    task.getStatus() != null ? task.getStatus().getCode() : "",
                    task.getCreatedAt() != null ? task.getCreatedAt().format(DATE_FORMAT) : "",
                    task.getUpdatedAt() != null ? task.getUpdatedAt().format(DATE_FORMAT) : "",
                    task.getCreatedBy(),
                    task.getRemark(),
                    task.getDiffCount() != null ? task.getDiffCount().toString() : "0",
                    task.getDiffPassed() != null ? task.getDiffPassed().toString() : "",
                    task.getSwitchConclusion() != null && task.getSwitchConclusion().getSwitchAllowed() != null
                            ? task.getSwitchConclusion().getSwitchAllowed().toString() : ""
            };
            writer.writeNext(data);

            if (task.getDiffs() != null && !task.getDiffs().isEmpty()) {
                writer.writeNext(new String[]{});
                writer.writeNext(new String[]{"差异详情"});
                writer.writeNext(new String[]{"字段名", "差异类型", "旧值", "新值", "描述"});
                for (FieldDiff diff : task.getDiffs()) {
                    writer.writeNext(new String[]{
                            diff.getFieldName(),
                            diff.getDiffType() != null ? diff.getDiffType().getCode() : "",
                            diff.getOldValue() != null ? diff.getOldValue().toString() : "",
                            diff.getNewValue() != null ? diff.getNewValue().toString() : "",
                            diff.getDescription()
                    });
                }
            }

            writer.flush();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("导出任务为CSV失败: taskId={}", task.getTaskId(), e);
            return new byte[0];
        }
    }

    public byte[] exportAllTasksAsCsv(List<MigrationTask> tasks) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             OutputStreamWriter osw = new OutputStreamWriter(baos, StandardCharsets.UTF_8);
             CSVWriter writer = new CSVWriter(osw)) {

            String[] header = {
                    "序号", "任务ID", "接口名称", "业务主键", "状态", "状态描述",
                    "创建时间", "更新时间", "创建人", "差异数量", "比对通过",
                    "旧库写入耗时(ms)", "新库写入耗时(ms)"
            };
            writer.writeNext(header);

            int index = 1;
            for (MigrationTask task : tasks) {
                String[] data = {
                        String.valueOf(index++),
                        task.getTaskId(),
                        task.getInterfaceName(),
                        task.getBusinessKey(),
                        task.getStatus() != null ? task.getStatus().getCode() : "",
                        task.getStatusDesc(),
                        task.getCreatedAt() != null ? task.getCreatedAt().format(DATE_FORMAT) : "",
                        task.getUpdatedAt() != null ? task.getUpdatedAt().format(DATE_FORMAT) : "",
                        task.getCreatedBy(),
                        task.getDiffCount() != null ? task.getDiffCount().toString() : "0",
                        task.getDiffPassed() != null ? task.getDiffPassed().toString() : "",
                        task.getOldWriteResult() != null && task.getOldWriteResult().getCostMs() != null
                                ? task.getOldWriteResult().getCostMs().toString() : "",
                        task.getNewWriteResult() != null && task.getNewWriteResult().getCostMs() != null
                                ? task.getNewWriteResult().getCostMs().toString() : ""
                };
                writer.writeNext(data);
            }

            writer.flush();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("导出所有任务为CSV失败", e);
            return new byte[0];
        }
    }

    public String generateDiffReport(MigrationTask task) {
        StringBuilder sb = new StringBuilder();
        sb.append("========================================\n");
        sb.append("接口迁移双写比对报告\n");
        sb.append("========================================\n\n");
        sb.append("任务ID: ").append(task.getTaskId()).append("\n");
        sb.append("接口名称: ").append(task.getInterfaceName()).append("\n");
        sb.append("业务主键: ").append(task.getBusinessKey()).append("\n");
        sb.append("状态: ").append(task.getStatusDesc()).append("\n");
        sb.append("创建时间: ").append(task.getCreatedAt() != null ? task.getCreatedAt().format(DATE_FORMAT) : "").append("\n");
        sb.append("\n");

        if (task.getOldWriteResult() != null) {
            sb.append("【旧库写入结果】\n");
            sb.append("  成功: ").append(task.getOldWriteResult().getSuccess()).append("\n");
            sb.append("  耗时: ").append(task.getOldWriteResult().getCostMs()).append("ms\n");
            sb.append("  主键值: ").append(task.getOldWriteResult().getPrimaryKeyValue()).append("\n\n");
        }

        if (task.getNewWriteResult() != null) {
            sb.append("【新库写入结果】\n");
            sb.append("  成功: ").append(task.getNewWriteResult().getSuccess()).append("\n");
            sb.append("  耗时: ").append(task.getNewWriteResult().getCostMs()).append("ms\n");
            sb.append("  主键值: ").append(task.getNewWriteResult().getPrimaryKeyValue()).append("\n\n");
        }

        if (task.getDiffs() != null && !task.getDiffs().isEmpty()) {
            sb.append("【发现 ").append(task.getDiffs().size()).append(" 处差异】\n");
            for (int i = 0; i < task.getDiffs().size(); i++) {
                FieldDiff diff = task.getDiffs().get(i);
                sb.append(String.format("%d. 字段[%s]: %s\n", i + 1, diff.getFieldName(), diff.getDescription()));
                sb.append(String.format("   旧值: %s -> 新值: %s\n", diff.getOldValue(), diff.getNewValue()));
            }
            sb.append("\n");
        } else {
            sb.append("【比对结果】无差异 ✓\n\n");
        }

        if (task.getSwitchConclusion() != null) {
            sb.append("【切换结论】\n");
            sb.append("  允许切换: ").append(task.getSwitchConclusion().getSwitchAllowed() ? "是 ✓" : "否 ✗").append("\n");
            sb.append("  风险等级: ").append(task.getSwitchConclusion().getRiskLevel()).append("\n");
            sb.append("  结论说明: ").append(task.getSwitchConclusion().getConclusion()).append("\n");
        }

        sb.append("\n========================================\n");
        return sb.toString();
    }
}
