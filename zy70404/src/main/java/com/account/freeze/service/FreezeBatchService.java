package com.account.freeze.service;

import com.account.freeze.dto.BatchPreviewResult;
import com.account.freeze.dto.SmsBatchCreateDTO;
import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.entity.FreezeBatchItem;
import com.account.freeze.enums.BatchItemStatus;
import com.account.freeze.enums.BatchStatus;
import com.account.freeze.enums.BatchType;
import com.account.freeze.mapper.FreezeBatchItemMapper;
import com.account.freeze.mapper.FreezeBatchMapper;
import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.DigestUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FreezeBatchService {

    private final FreezeBatchMapper freezeBatchMapper;
    private final FreezeBatchItemMapper freezeBatchItemMapper;
    private final FreezeRuleService freezeRuleService;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public String createSmsBatch(SmsBatchCreateDTO dto) {
        String inputHash = calculateInputHash(dto);
        FreezeBatch existingBatch = freezeBatchMapper.selectByInputHash(inputHash);
        if (existingBatch != null) {
            log.warn("发现重复批次，现有批次号: {}", existingBatch.getBatchNo());
            return existingBatch.getBatchNo();
        }

        String batchNo = generateBatchNo();
        Integer currentRuleVersion = freezeRuleService.getCurrentRuleVersion();

        FreezeBatch batch = new FreezeBatch();
        batch.setBatchNo(batchNo);
        batch.setBatchName(dto.getBatchName());
        batch.setBatchType(BatchType.SMS.getCode());
        batch.setStatus(BatchStatus.DRAFT.getCode());
        batch.setRuleVersion(currentRuleVersion);
        batch.setTotalCount(dto.getItems().size());
        batch.setSuccessCount(0);
        batch.setFailCount(0);
        batch.setInputHash(inputHash);
        batch.setOperator(dto.getOperator());
        batch.setRemark(dto.getRemark());
        batch.setCreatedTime(LocalDateTime.now());
        batch.setUpdatedTime(LocalDateTime.now());
        freezeBatchMapper.insert(batch);

        List<FreezeBatchItem> items = dto.getItems().stream().map(item -> {
            FreezeBatchItem batchItem = new FreezeBatchItem();
            batchItem.setBatchId(batch.getId());
            batchItem.setBatchNo(batchNo);
            batchItem.setAccountNo(item.getAccountNo());
            batchItem.setAccountName(item.getAccountName());
            batchItem.setPhone(item.getPhone());
            batchItem.setSmsContent(item.getSmsContent());
            batchItem.setSmsSendTime(item.getSmsSendTime());
            batchItem.setStatus(BatchItemStatus.PENDING.getCode());
            batchItem.setOperator(dto.getOperator());
            batchItem.setRemark(item.getRemark());
            batchItem.setCreatedTime(LocalDateTime.now());
            batchItem.setUpdatedTime(LocalDateTime.now());
            return batchItem;
        }).collect(Collectors.toList());

        items.forEach(freezeBatchItemMapper::insert);

        log.info("创建短信批次成功，批次号: {}, 数量: {}", batchNo, items.size());
        return batchNo;
    }

    public BatchPreviewResult previewBatch(String batchNo, String operator) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        List<FreezeBatchItem> items = freezeBatchItemMapper.selectByBatchId(batch.getId());

        BatchPreviewResult result = new BatchPreviewResult();
        result.setBatchNo(batchNo);
        result.setBatchName(batch.getBatchName());
        result.setTotalCount(items.size());
        result.setRuleVersion(batch.getRuleVersion());
        result.setRuleDesc(freezeRuleService.getRuleDesc(batch.getRuleVersion()));

        FreezeBatch existingBatch = freezeBatchMapper.selectByInputHash(batch.getInputHash());
        if (existingBatch != null && !existingBatch.getId().equals(batch.getId())) {
            result.setDuplicateTip("存在相同内容的历史批次");
            result.setExistingBatchId(existingBatch.getId());
            result.setExistingBatchNo(existingBatch.getBatchNo());
        }

        List<com.account.freeze.dto.BatchItemPreview> previews = new ArrayList<>();
        int estimatedSuccess = 0;
        int estimatedFail = 0;

        for (FreezeBatchItem item : items) {
            com.account.freeze.dto.BatchItemPreview preview = new com.account.freeze.dto.BatchItemPreview();
            preview.setAccountNo(item.getAccountNo());
            preview.setAccountName(item.getAccountName());
            preview.setPhone(item.getPhone());

            boolean evidenceComplete = item.getSmsContent() != null && !item.getSmsContent().isEmpty();
            preview.setEvidenceComplete(evidenceComplete);
            preview.setAlreadyFrozen(false);

            if (evidenceComplete) {
                preview.setEstimatedResult("预计成功");
                preview.setEstimatedReason("证据链完整，符合冻结条件");
                estimatedSuccess++;
            } else {
                preview.setEstimatedResult("预计失败");
                preview.setEstimatedReason("短信内容缺失，证据链断裂");
                estimatedFail++;
            }

            previews.add(preview);
        }

        result.setEstimatedSuccess(estimatedSuccess);
        result.setEstimatedFail(estimatedFail);
        result.setItems(previews);

        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void confirmPreview(String batchNo, String operator) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        batch.setStatus(BatchStatus.PREVIEWED.getCode());
        batch.setPreviewTime(LocalDateTime.now());
        batch.setUpdatedTime(LocalDateTime.now());
        freezeBatchMapper.updateById(batch);

        freezeBatchItemMapper.update(
            null,
            new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<FreezeBatchItem>()
                .eq(FreezeBatchItem::getBatchId, batch.getId())
                .set(FreezeBatchItem::getStatus, BatchItemStatus.PREVIEWED.getCode())
        );

        log.info("批次预览确认完成，批次号: {}", batchNo);
    }

    private String calculateInputHash(SmsBatchCreateDTO dto) {
        try {
            String content = objectMapper.writeValueAsString(dto.getItems());
            return DigestUtil.sha256Hex(content);
        } catch (JsonProcessingException e) {
            log.error("计算输入哈希失败", e);
            return IdUtil.simpleUUID();
        }
    }

    private String generateBatchNo() {
        return "FRZ" + System.currentTimeMillis();
    }

    public FreezeBatch getByBatchNo(String batchNo) {
        return freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
    }

    public List<FreezeBatchItem> getBatchItems(Long batchId) {
        return freezeBatchItemMapper.selectByBatchId(batchId);
    }
}
