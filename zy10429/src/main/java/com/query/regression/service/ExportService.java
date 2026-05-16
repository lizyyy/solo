package com.query.regression.service;

import com.query.regression.dto.RegressionDetailDTO;
import com.query.regression.entity.PlanDifference;
import com.query.regression.entity.QueryParameter;
import com.query.regression.entity.RegressionRecord;
import com.query.regression.repository.RegressionRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final RegressionRecordRepository recordRepository;
    private final RegressionService regressionService;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportAllToCSV() {
        List<RegressionRecord> records = recordRepository.findAll();
        return exportToCSV(records);
    }

    public byte[] exportToCSV(List<RegressionRecord> records) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             PrintWriter writer = new PrintWriter(out);
             CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                     .setHeader(
                             "记录ID",
                             "查询名称",
                             "状态",
                             "风险等级",
                             "结论",
                             "成本变化(%)",
                             "差异数量",
                             "创建人",
                             "创建时间",
                             "确认人",
                             "确认时间",
                             "备注"
                     )
                     .build())) {

            for (RegressionRecord record : records) {
                csvPrinter.printRecord(
                        record.getId(),
                        record.getQueryName(),
                        record.getStatus(),
                        record.getRiskLevel(),
                        record.getConclusion(),
                        record.getCostDiffPercentage(),
                        record.getPlanDiffCount(),
                        record.getCreatedBy(),
                        record.getCreatedAt() != null ? record.getCreatedAt().format(DATE_FORMAT) : "",
                        record.getConfirmedBy(),
                        record.getConfirmedAt() != null ? record.getConfirmedAt().format(DATE_FORMAT) : "",
                        record.getConclusionNotes()
                );
            }

            csvPrinter.flush();
            log.info("导出CSV完成，共 {} 条记录", records.size());
            return out.toByteArray();

        } catch (Exception e) {
            log.error("导出CSV失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }

    public String exportDetailToMarkdown(Long recordId) {
        RegressionDetailDTO detail = regressionService.getRegressionDetail(recordId);
        return generateMarkdownReport(detail);
    }

    private String generateMarkdownReport(RegressionDetailDTO detail) {
        StringBuilder md = new StringBuilder();
        RegressionRecord record = detail.getRecord();

        md.append("# 查询计划回归分析报告\n\n");
        md.append("## 基本信息\n\n");
        md.append("| 字段 | 值 |\n");
        md.append("|------|-----|\n");
        md.append(String.format("| 记录ID | %d |\n", record.getId()));
        md.append(String.format("| 查询名称 | %s |\n", record.getQueryName()));
        md.append(String.format("| 状态 | %s |\n", record.getStatus()));
        md.append(String.format("| 风险等级 | %s |\n", record.getRiskLevel()));
        md.append(String.format("| 结论 | %s |\n", record.getConclusion()));
        md.append(String.format("| 成本变化 | %.2f%% |\n", record.getCostDiffPercentage() != null ? record.getCostDiffPercentage() : 0));
        md.append(String.format("| 创建人 | %s |\n", record.getCreatedBy()));
        md.append(String.format("| 创建时间 | %s |\n", 
                record.getCreatedAt() != null ? record.getCreatedAt().format(DATE_FORMAT) : "-"));
        md.append("\n");

        md.append("## 参数信息\n\n");
        if (detail.getParameters() != null && !detail.getParameters().isEmpty()) {
            md.append("| 参数名 | 参数值 | 类型 |\n");
            md.append("|--------|--------|------|\n");
            for (QueryParameter param : detail.getParameters()) {
                md.append(String.format("| %s | %s | %s |\n",
                        param.getParamKey(),
                        param.getParamValue(),
                        param.getParamType()));
            }
        } else {
            md.append("无参数信息\n");
        }
        md.append("\n");

        md.append("## 执行计划对比\n\n");
        if (detail.getOldPlan() != null && detail.getNewPlan() != null) {
            md.append("| 指标 | 旧计划 | 新计划 | 变化 |\n");
            md.append("|------|--------|--------|------|\n");
            md.append(String.format("| 估计成本 | %.2f | %.2f | %+.2f%% |\n",
                    detail.getOldPlan().getEstimatedCost(),
                    detail.getNewPlan().getEstimatedCost(),
                    record.getCostDiffPercentage() != null ? record.getCostDiffPercentage() : 0));
            md.append(String.format("| 估计行数 | %d | %d | %+d |\n",
                    detail.getOldPlan().getEstimatedRows(),
                    detail.getNewPlan().getEstimatedRows(),
                    detail.getNewPlan().getEstimatedRows() - detail.getOldPlan().getEstimatedRows()));
            md.append(String.format("| 连接数 | %d | %d | %+d |\n",
                    detail.getOldPlan().getJoinCount(),
                    detail.getNewPlan().getJoinCount(),
                    detail.getNewPlan().getJoinCount() - detail.getOldPlan().getJoinCount()));
            md.append(String.format("| 全表扫描数 | %d | %d | %+d |\n",
                    detail.getOldPlan().getFullScanCount(),
                    detail.getNewPlan().getFullScanCount(),
                    detail.getNewPlan().getFullScanCount() - detail.getOldPlan().getFullScanCount()));
            md.append(String.format("| 使用索引 | %s | %s | |\n",
                    detail.getOldPlan().getIndexesUsed(),
                    detail.getNewPlan().getIndexesUsed()));
        }
        md.append("\n");

        md.append("## 差异详情\n\n");
        if (detail.getDifferences() != null && !detail.getDifferences().isEmpty()) {
            md.append("| 差异类型 | 旧值 | 新值 | 风险等级 | 描述 |\n");
            md.append("|----------|------|------|----------|------|\n");
            for (PlanDifference diff : detail.getDifferences()) {
                md.append(String.format("| %s | %s | %s | %s | %s |\n",
                        diff.getDiffType(),
                        diff.getOldValue(),
                        diff.getNewValue(),
                        diff.getRiskLevel(),
                        diff.getDescription()));
            }
        } else {
            md.append("无显著差异\n");
        }
        md.append("\n");

        if (record.getConclusionNotes() != null && !record.getConclusionNotes().isEmpty()) {
            md.append("## 备注\n\n");
            md.append(record.getConclusionNotes()).append("\n\n");
        }

        if (record.getErrorMessage() != null) {
            md.append("## 错误信息\n\n");
            md.append("```\n").append(record.getErrorMessage()).append("\n```\n\n");
        }

        return md.toString();
    }
}
