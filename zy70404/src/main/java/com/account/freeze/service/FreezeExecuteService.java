package com.account.freeze.service;

import com.account.freeze.entity.FreezeBatch;
import com.account.freeze.entity.FreezeBatchItem;
import com.account.freeze.enums.BatchItemStatus;
import com.account.freeze.enums.BatchStatus;
import com.account.freeze.enums.EvidenceChainStatus;
import com.account.freeze.mapper.FreezeBatchItemMapper;
import com.account.freeze.mapper.FreezeBatchMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class FreezeExecuteService {

    private final FreezeBatchMapper freezeBatchMapper;
    private final FreezeBatchItemMapper freezeBatchItemMapper;
    private final EvidenceChainService evidenceChainService;
    private final OperationLogService operationLogService;

    @Async
    @Transactional(rollbackFor = Exception.class)
    public void executeBatch(String batchNo, String operator) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        if (!BatchStatus.PREVIEWED.getCode().equals(batch.getStatus())) {
            throw new RuntimeException("批次状态不正确，需先预览确认");
        }

        batch.setStatus(BatchStatus.EXECUTING.getCode());
        batch.setExecuteTime(LocalDateTime.now());
        batch.setUpdatedTime(LocalDateTime.now());
        freezeBatchMapper.updateById(batch);

        List<FreezeBatchItem> items = freezeBatchItemMapper.selectByBatchId(batch.getId());

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);

        for (FreezeBatchItem item : items) {
            try {
                executeItem(batch, item, operator);
                successCount.incrementAndGet();
            } catch (Exception e) {
                log.error("执行冻结失败，账号: {}", item.getAccountNo(), e);
                failCount.incrementAndGet();
                updateItemStatus(item.getId(), BatchItemStatus.FAILED.getCode(), e.getMessage());
            }
        }

        updateBatchStatus(batch.getId(), successCount.get(), failCount.get());

        operationLogService.logOperation(
            batch.getId(),
            null,
            "BATCH_EXECUTE",
            String.format("批次执行完成，成功: %d, 失败: %d", successCount.get(), failCount.get()),
            operator
        );
    }

    private void executeItem(FreezeBatch batch, FreezeBatchItem item, String operator) {
        updateItemStatus(item.getId(), BatchItemStatus.PROCESSING.getCode(), null);

        Long evidenceChainId = evidenceChainService.createEvidenceChain(
            batch.getId(),
            item.getId(),
            item.getAccountNo(),
            item.getSmsContent(),
            operator
        );

        boolean evidenceComplete = evidenceChainService.validateEvidenceChain(evidenceChainId);
        if (!evidenceComplete) {
            evidenceChainService.updateEvidenceChainStatus(evidenceChainId, EvidenceChainStatus.BROKEN.getCode(), "证据链不完整");
            throw new RuntimeException("证据链不完整，无法冻结");
        }

        boolean freezeResult = callFreezeSystem(item.getAccountNo());

        if (freezeResult) {
            updateItemStatus(item.getId(), BatchItemStatus.SUCCESS.getCode(), null);
            item.setEvidenceChainId(evidenceChainId);
            item.setFreezeTime(LocalDateTime.now());
            freezeBatchItemMapper.updateById(item);
            evidenceChainService.updateEvidenceChainStatus(evidenceChainId, EvidenceChainStatus.COMPLETE.getCode(), null);
        } else {
            throw new RuntimeException("调用冻结系统失败");
        }

        operationLogService.logOperation(
            batch.getId(),
            item.getId(),
            "ITEM_FREEZE",
            String.format("账号 %s 冻结成功", item.getAccountNo()),
            operator
        );
    }

    private boolean callFreezeSystem(String accountNo) {
        log.info("调用冻结系统，账号: {}", accountNo);
        return true;
    }

    private void updateItemStatus(Long itemId, String status, String failReason) {
        FreezeBatchItem item = new FreezeBatchItem();
        item.setId(itemId);
        item.setStatus(status);
        item.setFailReason(failReason);
        item.setUpdatedTime(LocalDateTime.now());
        freezeBatchItemMapper.updateById(item);
    }

    private void updateBatchStatus(Long batchId, int successCount, int failCount) {
        FreezeBatch batch = new FreezeBatch();
        batch.setId(batchId);
        batch.setSuccessCount(successCount);
        batch.setFailCount(failCount);
        batch.setFinishTime(LocalDateTime.now());
        batch.setUpdatedTime(LocalDateTime.now());

        if (successCount > 0 && failCount > 0) {
            batch.setStatus(BatchStatus.PARTIAL_SUCCESS.getCode());
        } else if (successCount > 0) {
            batch.setStatus(BatchStatus.SUCCESS.getCode());
        } else {
            batch.setStatus(BatchStatus.FAILED.getCode());
        }

        freezeBatchMapper.updateById(batch);
    }

    public String getExecutionStatus(String batchNo) {
        FreezeBatch batch = freezeBatchMapper.selectOne(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<FreezeBatch>()
                .eq(FreezeBatch::getBatchNo, batchNo)
        );
        if (batch == null) {
            throw new RuntimeException("批次不存在");
        }

        return batch.getStatus();
    }
}
