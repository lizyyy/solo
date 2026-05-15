package com.api.slimming.service;

import cn.hutool.core.util.StrUtil;
import com.api.slimming.dto.ApiResult;
import com.api.slimming.dto.HistoryQueryRequest;
import com.api.slimming.dto.RecordQueryRequest;
import com.api.slimming.entity.RuleHistory;
import com.api.slimming.entity.SlimmingRecord;
import com.api.slimming.mapper.RuleHistoryMapper;
import com.api.slimming.mapper.SlimmingRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class RecordQueryService {

    @Autowired
    private SlimmingRecordMapper slimmingRecordMapper;

    @Autowired
    private RuleHistoryMapper ruleHistoryMapper;

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ApiResult<IPage<SlimmingRecord>> queryRecords(RecordQueryRequest request) {
        Page<SlimmingRecord> page = new Page<>(request.getPageNum(), request.getPageSize());

        LambdaQueryWrapper<SlimmingRecord> queryWrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(request.getRequestId())) {
            queryWrapper.eq(SlimmingRecord::getRequestId, request.getRequestId());
        }
        if (StrUtil.isNotBlank(request.getRuleNo())) {
            queryWrapper.like(SlimmingRecord::getRuleNo, request.getRuleNo());
        }
        if (StrUtil.isNotBlank(request.getApiPath())) {
            queryWrapper.like(SlimmingRecord::getApiPath, request.getApiPath());
        }
        if (StrUtil.isNotBlank(request.getSceneCode())) {
            queryWrapper.eq(SlimmingRecord::getSceneCode, request.getSceneCode());
        }
        if (request.getSuccess() != null) {
            queryWrapper.eq(SlimmingRecord::getSuccess, request.getSuccess());
        }
        if (request.getRequestTimeStart() != null) {
            queryWrapper.ge(SlimmingRecord::getRequestTime, request.getRequestTimeStart());
        }
        if (request.getRequestTimeEnd() != null) {
            queryWrapper.le(SlimmingRecord::getRequestTime, request.getRequestTimeEnd());
        }
        queryWrapper.orderByDesc(SlimmingRecord::getRequestTime);

        IPage<SlimmingRecord> result = slimmingRecordMapper.selectPage(page, queryWrapper);
        return ApiResult.success(result);
    }

    public ApiResult<SlimmingRecord> getRecordById(Long id) {
        SlimmingRecord record = slimmingRecordMapper.selectById(id);
        if (record == null) {
            return ApiResult.fail(404, "记录不存在");
        }
        return ApiResult.success(record);
    }

    public ApiResult<byte[]> exportRecords(RecordQueryRequest request) {
        request.setPageNum(1);
        request.setPageSize(10000);

        IPage<SlimmingRecord> pageResult = queryRecords(request).getData();
        List<SlimmingRecord> records = pageResult.getRecords();

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8));

            writer.println("请求ID,规则编号,API路径,场景编码,原始大小(bytes),瘦身大小(bytes),节省大小(bytes),节省比例(%),请求时间,执行状态,错误信息");

            for (SlimmingRecord record : records) {
                writer.print(escapeCsv(record.getRequestId()));
                writer.print(",");
                writer.print(escapeCsv(record.getRuleNo()));
                writer.print(",");
                writer.print(escapeCsv(record.getApiPath()));
                writer.print(",");
                writer.print(escapeCsv(record.getSceneCode()));
                writer.print(",");
                writer.print(record.getOriginalSize());
                writer.print(",");
                writer.print(record.getSlimmedSize());
                writer.print(",");
                writer.print(record.getSavedSize());
                writer.print(",");
                writer.print(record.getSavedRatio());
                writer.print(",");
                writer.print(record.getRequestTime() != null ? record.getRequestTime().format(DATE_TIME_FORMATTER) : "");
                writer.print(",");
                writer.print(record.getSuccess() != null && record.getSuccess() ? "成功" : "失败");
                writer.print(",");
                writer.print(escapeCsv(record.getErrorMessage()));
                writer.println();
            }

            writer.flush();
            return ApiResult.success(baos.toByteArray());
        } catch (Exception e) {
            return ApiResult.fail("导出失败: " + e.getMessage());
        }
    }

    public ApiResult<IPage<RuleHistory>> queryHistory(HistoryQueryRequest request) {
        Page<RuleHistory> page = new Page<>(request.getPageNum(), request.getPageSize());

        LambdaQueryWrapper<RuleHistory> queryWrapper = new LambdaQueryWrapper<>();
        if (request.getRuleId() != null) {
            queryWrapper.eq(RuleHistory::getRuleId, request.getRuleId());
        }
        if (StrUtil.isNotBlank(request.getRuleNo())) {
            queryWrapper.like(RuleHistory::getRuleNo, request.getRuleNo());
        }
        if (request.getOperationType() != null) {
            queryWrapper.eq(RuleHistory::getOperationType, request.getOperationType());
        }
        if (StrUtil.isNotBlank(request.getOperator())) {
            queryWrapper.eq(RuleHistory::getOperator, request.getOperator());
        }
        if (request.getCreateTimeStart() != null) {
            queryWrapper.ge(RuleHistory::getCreateTime, request.getCreateTimeStart());
        }
        if (request.getCreateTimeEnd() != null) {
            queryWrapper.le(RuleHistory::getCreateTime, request.getCreateTimeEnd());
        }
        queryWrapper.orderByDesc(RuleHistory::getCreateTime);

        IPage<RuleHistory> result = ruleHistoryMapper.selectPage(page, queryWrapper);
        return ApiResult.success(result);
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
