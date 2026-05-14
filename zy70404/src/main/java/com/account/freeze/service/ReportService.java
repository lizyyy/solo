package com.account.freeze.service;

import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.entity.FreezeBatchItem;
import com.account.freeze.entity.FreezeReport;
import com.account.freeze.mapper.FreezeBatchItemMapper;
import com.account.freeze.mapper.FreezeBatchMapper;
import com.account.freeze.mapper.FreezeReportMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final FreezeReportMapper freezeReportMapper;
    private final FreezeBatchMapper freezeBatchMapper;
    private final FreezeBatchItemMapper freezeBatchItemMapper;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public String generateBatchReport(String batchNo, String operator) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        List<FreezeBatchItem> items = freezeBatchItemMapper.selectByBatchId(batch.getId());

        Map<String, Object> reportContent = new HashMap<>();
        reportContent.put("batchNo", batchNo);
        reportContent.put("batchName", batch.getBatchName());
        reportContent.put("ruleVersion", batch.getRuleVersion());
        reportContent.put("totalCount", batch.getTotalCount());
        reportContent.put("successCount", batch.getSuccessCount());
        reportContent.put("failCount", batch.getFailCount());
        reportContent.put("executeTime", batch.getExecuteTime());
        reportContent.put("finishTime", batch.getFinishTime());

        StringBuilder summaryAbstract = new StringBuilder();
        summaryAbstract.append("批次摘要: ").append(batch.getBatchName()).append("\n");
        summaryAbstract.append("输入: 共 ").append(batch.getTotalCount()).append(" 个账号\n");
        summaryAbstract.append("动作: 批量账号冻结\n");
        summaryAbstract.append("结论: 成功 ").append(batch.getSuccessCount())
                       .append(" 个，失败 ").append(batch.getFailCount()).append(" 个\n");
        summaryAbstract.append("规则版本: v").append(batch.getRuleVersion());

        String reportNo = "RPT" + System.currentTimeMillis();

        FreezeReport report = new FreezeReport();
        report.setReportNo(reportNo);
        report.setReportType("BATCH_SUMMARY");
        report.setBatchId(batch.getId());
        report.setReportTitle("批量冻结报告-" + batchNo);
        
        try {
            report.setReportContent(objectMapper.writeValueAsString(reportContent));
        } catch (Exception e) {
            report.setReportContent("{}");
        }
        
        report.setSummaryAbstract(summaryAbstract.toString());
        report.setLogisticsReviewSample("示例物流拦截截图占位符");
        report.setOperator(operator);
        report.setCreatedTime(LocalDateTime.now());
        report.setUpdatedTime(LocalDateTime.now());

        freezeReportMapper.insert(report);

        log.info("生成批次报告成功，报告号: {}", reportNo);
        return reportNo;
    }

    public FreezeReport getByReportNo(String reportNo) {
        return freezeReportMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeReport>()
                .eq(FreezeReport::getReportNo, reportNo)
        );
    }
}
