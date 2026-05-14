package com.approval.coordinator.service;

import com.approval.coordinator.model.dto.*;
import com.approval.coordinator.model.entity.ApprovalBatch;
import com.approval.coordinator.model.entity.ApprovalItem;
import com.approval.coordinator.model.enums.BatchStatus;
import com.approval.coordinator.model.enums.ItemStatus;
import com.approval.coordinator.repository.ApprovalBatchRepository;
import com.approval.coordinator.repository.ApprovalItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BatchService {

    private final ApprovalBatchRepository batchRepository;
    private final ApprovalItemRepository itemRepository;
    private final TimelineService timelineService;

    @Value("${approval.batch.default-chunk-size:10}")
    private int defaultChunkSize;

    @Value("${approval.batch.max-size:100}")
    private int maxBatchSize;

    @Transactional
    public ApiResponse<ApprovalBatch> createBatch(BatchCreateRequest request) {
        log.info("创建审批批次: batchId={}, itemCount={}", request.getBatchId(), request.getItems().size());

        if (batchRepository.existsByBatchId(request.getBatchId())) {
            log.warn("批次已存在: {}", request.getBatchId());
            return ApiResponse.error("BATCH_EXISTS", "批次ID已存在，避免重复提交");
        }

        if (request.getItems().size() > maxBatchSize) {
            return ApiResponse.error("BATCH_TOO_LARGE", "批次大小超过限制，最大" + maxBatchSize + "条");
        }

        List<String> duplicateIdempotentKeys = checkDuplicateIdempotentKeys(request.getItems());
        if (!duplicateIdempotentKeys.isEmpty()) {
            return ApiResponse.error("DUPLICATE_IDEMPOTENT_KEY", "存在重复的幂等键: " + String.join(", ", duplicateIdempotentKeys));
        }

        List<String> existingIdempotentKeys = checkExistingIdempotentKeys(request.getItems());
        if (!existingIdempotentKeys.isEmpty()) {
            return ApiResponse.error("IDEMPOTENT_KEY_EXISTS", "幂等键已存在: " + String.join(", ", existingIdempotentKeys));
        }

        int chunkSize = request.getChunkSize() != null ? request.getChunkSize() : defaultChunkSize;
        int totalChunks = (int) Math.ceil((double) request.getItems().size() / chunkSize);

        ApprovalBatch batch = ApprovalBatch.builder()
                .batchId(request.getBatchId())
                .businessType(request.getBusinessType())
                .sourceSystem(request.getSourceSystem())
                .callbackUrl(request.getCallbackUrl())
                .status(BatchStatus.CREATED)
                .totalCount(request.getItems().size())
                .successCount(0)
                .failedCount(0)
                .chunkSize(chunkSize)
                .currentChunk(0)
                .totalChunks(totalChunks)
                .createdBy(request.getCreatedBy())
                .remark(request.getRemark())
                .build();

        batch = batchRepository.save(batch);

        List<ApprovalItem> items = createItems(batch, request.getItems(), chunkSize);
        itemRepository.saveAll(items);

        timelineService.addEvent(batch, "BATCH_CREATED", "批次创建成功，共" + request.getItems().size() + "条单据，分为" + totalChunks + "个分片", request.getCreatedBy());

        log.info("审批批次创建成功: batchId={}", request.getBatchId());
        return ApiResponse.success("批次创建成功", batch);
    }

    private List<String> checkDuplicateIdempotentKeys(List<ApprovalItemRequest> items) {
        Map<String, Long> keyCount = items.stream()
                .collect(Collectors.groupingBy(ApprovalItemRequest::getIdempotentKey, Collectors.counting()));
        return keyCount.entrySet().stream()
                .filter(entry -> entry.getValue() > 1)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    private List<String> checkExistingIdempotentKeys(List<ApprovalItemRequest> items) {
        return items.stream()
                .map(ApprovalItemRequest::getIdempotentKey)
                .filter(itemRepository::existsByIdempotentKey)
                .collect(Collectors.toList());
    }

    private List<ApprovalItem> createItems(ApprovalBatch batch, List<ApprovalItemRequest> itemRequests, int chunkSize) {
        List<ApprovalItem> items = new ArrayList<>();
        for (int i = 0; i < itemRequests.size(); i++) {
            ApprovalItemRequest request = itemRequests.get(i);
            int chunkNumber = (i / chunkSize) + 1;
            ApprovalItem item = ApprovalItem.builder()
                    .batch(batch)
                    .itemId(request.getItemId())
                    .idempotentKey(request.getIdempotentKey())
                    .chunkNumber(chunkNumber)
                    .sequenceNumber(i + 1)
                    .status(ItemStatus.PENDING)
                    .businessData(request.getBusinessData())
                    .callbackPayload(request.getCallbackPayload())
                    .retryCount(0)
                    .build();
            items.add(item);
        }
        return items;
    }

    @Transactional
    public ApiResponse<ApprovalBatch> startProcessing(String batchId, String operator) {
        log.info("开始处理批次: batchId={}", batchId);
        return batchRepository.findByBatchId(batchId)
                .map(batch -> {
                    if (batch.getStatus() != BatchStatus.CREATED && batch.getStatus() != BatchStatus.VALIDATED) {
                        return ApiResponse.error("INVALID_STATUS", "批次状态不允许开始处理，当前状态: " + batch.getStatus());
                    }
                    BatchStatus previousStatus = batch.getStatus();
                    batch.setStatus(BatchStatus.PROCESSING);
                    batch.setCurrentChunk(1);
                    batchRepository.save(batch);
                    timelineService.addStatusChangeEvent(batch, previousStatus.name(), BatchStatus.PROCESSING.name(), operator);
                    timelineService.addEvent(batch, "PROCESSING_START", "开始处理第1个分片，共" + batch.getTotalChunks() + "个分片", operator);
                    return ApiResponse.success("开始处理成功", batch);
                })
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    @Transactional
    public ApiResponse<Map<String, Object>> processCallbackResult(CallbackResultRequest request) {
        log.info("处理回调结果: batchId={}, resultCount={}", request.getBatchId(), request.getResults().size());
        return batchRepository.findByBatchId(request.getBatchId())
                .map(batch -> {
                    if (batch.getStatus() != BatchStatus.PROCESSING && batch.getStatus() != BatchStatus.PARTIAL_SUCCESS && batch.getStatus() != BatchStatus.REPLAYING) {
                        return ApiResponse.error("INVALID_STATUS", "批次状态不允许处理回调，当前状态: " + batch.getStatus());
                    }

                    int successCount = 0;
                    int failedCount = 0;
                    int skippedCount = 0;
                    List<String> successItemIds = new ArrayList<>();
                    List<String> failedItemIds = new ArrayList<>();
                    List<String> skippedItemIds = new ArrayList<>();

                    for (ItemCallbackResult result : request.getResults()) {
                        Optional<ApprovalItem> itemOpt = itemRepository.findByBatch_BatchIdAndItemId(request.getBatchId(), result.getItemId());
                        if (itemOpt.isPresent()) {
                            ApprovalItem item = itemOpt.get();
                            ItemStatus previousStatus = item.getStatus();

                            boolean wasSuccess = ItemStatus.SUCCESS.equals(previousStatus);
                            boolean wasFailed = ItemStatus.FAILED.equals(previousStatus);
                            boolean isReplaying = ItemStatus.REPLAYING.equals(previousStatus);

                            if (!isReplaying && (wasSuccess || wasFailed)) {
                                skippedCount++;
                                skippedItemIds.add(result.getItemId());
                                log.warn("单据已处于终态，跳过重复回调: itemId={}, currentStatus={}", result.getItemId(), previousStatus);
                                continue;
                            }

                            if (result.isSuccess()) {
                                item.setStatus(ItemStatus.SUCCESS);
                                item.setResponseData(result.getResponseData());
                                item.setCompletedAt(LocalDateTime.now());

                                if (isReplaying && wasFailed) {
                                    batch.setFailedCount(batch.getFailedCount() - 1);
                                    log.info("重放成功，扣减失败计数: itemId={}", result.getItemId());
                                }
                                if (!wasSuccess) {
                                    successCount++;
                                    successItemIds.add(result.getItemId());
                                }
                                timelineService.addItemEvent(batch, result.getItemId(), "ITEM_SUCCESS", "单据处理成功", request.getOperator());
                            } else {
                                item.setStatus(ItemStatus.FAILED);
                                item.setResponseData(result.getResponseData());
                                item.setErrorCode(result.getErrorCode());
                                item.setErrorMessage(result.getErrorMessage());
                                item.setCompletedAt(LocalDateTime.now());

                                if (isReplaying && wasSuccess) {
                                    batch.setSuccessCount(batch.getSuccessCount() - 1);
                                    log.info("重放失败，扣减成功计数: itemId={}", result.getItemId());
                                }
                                if (!wasFailed) {
                                    failedCount++;
                                    failedItemIds.add(result.getItemId());
                                }
                                timelineService.addItemEvent(batch, result.getItemId(), "ITEM_FAILED", "单据处理失败: " + result.getErrorMessage(), request.getOperator());
                            }
                            itemRepository.save(item);
                        }
                    }

                    batch.setSuccessCount(batch.getSuccessCount() + successCount);
                    batch.setFailedCount(batch.getFailedCount() + failedCount);

                    if (batch.getSuccessCount() < 0) batch.setSuccessCount(0);
                    if (batch.getFailedCount() < 0) batch.setFailedCount(0);

                    updateBatchStatus(batch, request.getOperator());
                    batchRepository.save(batch);

                    Map<String, Object> result = new HashMap<>();
                    result.put("batchId", request.getBatchId());
                    result.put("processedCount", successCount + failedCount);
                    result.put("successCount", successCount);
                    result.put("failedCount", failedCount);
                    result.put("skippedCount", skippedCount);
                    result.put("successItemIds", successItemIds);
                    result.put("failedItemIds", failedItemIds);
                    result.put("skippedItemIds", skippedItemIds);
                    result.put("currentStatus", batch.getStatus().name());

                    return ApiResponse.success("回调结果处理成功", result);
                })
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    private void updateBatchStatus(ApprovalBatch batch, String operator) {
        int totalProcessed = batch.getSuccessCount() + batch.getFailedCount();
        if (totalProcessed >= batch.getTotalCount()) {
            BatchStatus previousStatus = batch.getStatus();
            if (batch.getFailedCount() == 0) {
                batch.setStatus(BatchStatus.COMPLETED);
                batch.setCompletedAt(LocalDateTime.now());
                timelineService.addStatusChangeEvent(batch, previousStatus.name(), BatchStatus.COMPLETED.name(), operator);
                timelineService.addEvent(batch, "BATCH_COMPLETED", "批次全部处理完成，成功" + batch.getSuccessCount() + "条", operator);
            } else {
                batch.setStatus(BatchStatus.PARTIAL_SUCCESS);
                batch.setCompletedAt(LocalDateTime.now());
                timelineService.addStatusChangeEvent(batch, previousStatus.name(), BatchStatus.PARTIAL_SUCCESS.name(), operator);
                timelineService.addEvent(batch, "BATCH_PARTIAL_SUCCESS", "批次部分处理完成，成功" + batch.getSuccessCount() + "条，失败" + batch.getFailedCount() + "条", operator);
            }
        }
    }

    @Transactional
    public ApiResponse<Map<String, Object>> replayItems(ReplayRequest request) {
        log.info("重放单据: batchId={}", request.getBatchId());
        return batchRepository.findByBatchId(request.getBatchId())
                .map(batch -> {
                    List<ApprovalItem> itemsToReplay = new ArrayList<>();
                    List<String> skippedItemIds = new ArrayList<>();

                    if (request.isReplayAllFailed()) {
                        itemsToReplay = itemRepository.findByBatch_BatchIdAndStatus(request.getBatchId(), ItemStatus.FAILED);
                    } else if (request.getItemIds() != null && !request.getItemIds().isEmpty()) {
                        List<ApprovalItem> allItems = itemRepository.findByBatch_BatchIdAndItemIdIn(request.getBatchId(), request.getItemIds());
                        for (ApprovalItem item : allItems) {
                            if (ItemStatus.FAILED.equals(item.getStatus()) || ItemStatus.REPLAYING.equals(item.getStatus())) {
                                itemsToReplay.add(item);
                            } else {
                                skippedItemIds.add(item.getItemId());
                                log.warn("单据状态不允许重放: itemId={}, status={}", item.getItemId(), item.getStatus());
                            }
                        }
                    } else if (request.getChunkNumbers() != null && !request.getChunkNumbers().isEmpty()) {
                        for (Integer chunkNumber : request.getChunkNumbers()) {
                            List<ApprovalItem> chunkItems = itemRepository.findByBatch_BatchIdAndChunkNumber(request.getBatchId(), chunkNumber);
                            for (ApprovalItem item : chunkItems) {
                                if (ItemStatus.FAILED.equals(item.getStatus()) || ItemStatus.REPLAYING.equals(item.getStatus())) {
                                    itemsToReplay.add(item);
                                } else {
                                    skippedItemIds.add(item.getItemId());
                                }
                            }
                        }
                    }

                    if (itemsToReplay.isEmpty() && skippedItemIds.isEmpty()) {
                        return ApiResponse.error("NO_ITEMS_TO_REPLAY", "没有找到需要重放的单据");
                    }

                    BatchStatus previousStatus = batch.getStatus();
                    if (BatchStatus.COMPLETED.equals(previousStatus) || BatchStatus.PARTIAL_SUCCESS.equals(previousStatus)) {
                        batch.setStatus(BatchStatus.REPLAYING);
                        batchRepository.save(batch);
                        timelineService.addStatusChangeEvent(batch, previousStatus.name(), BatchStatus.REPLAYING.name(), request.getOperator());
                    }

                    for (ApprovalItem item : itemsToReplay) {
                        ItemStatus oldStatus = item.getStatus();
                        item.setStatus(ItemStatus.REPLAYING);
                        item.setRetryCount(item.getRetryCount() + 1);
                        itemRepository.save(item);
                        timelineService.addItemEvent(batch, item.getItemId(), "ITEM_REPLAYING", "单据开始重放，重试次数: " + item.getRetryCount(), request.getOperator());
                    }

                    Map<String, Object> result = new HashMap<>();
                    result.put("batchId", request.getBatchId());
                    result.put("replayCount", itemsToReplay.size());
                    result.put("skippedCount", skippedItemIds.size());
                    result.put("replayItemIds", itemsToReplay.stream().map(ApprovalItem::getItemId).collect(Collectors.toList()));
                    result.put("skippedItemIds", skippedItemIds);

                    if (!itemsToReplay.isEmpty()) {
                        timelineService.addEvent(batch, "REPLAY_STARTED", "开始重放" + itemsToReplay.size() + "条单据", request.getOperator());
                    }

                    return ApiResponse.success("重放任务已创建", result);
                })
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    public ApiResponse<ApprovalBatch> getBatchDetail(String batchId) {
        return batchRepository.findByBatchId(batchId)
                .map(batch -> ApiResponse.success(batch))
                .orElse(ApiResponse.error("BATCH_NOT_FOUND", "批次不存在"));
    }

    public ApiResponse<List<ApprovalItem>> getBatchItems(String batchId) {
        List<ApprovalItem> items = itemRepository.findByBatch_BatchId(batchId);
        return ApiResponse.success(items);
    }

    public ApiResponse<List<ApprovalItem>> getFailedItems(String batchId) {
        List<ApprovalItem> items = itemRepository.findByBatch_BatchIdAndStatus(batchId, ItemStatus.FAILED);
        return ApiResponse.success(items);
    }

    public ApiResponse<List<ApprovalBatch>> listBatches(LocalDateTime startTime, LocalDateTime endTime, String sourceSystem) {
        List<ApprovalBatch> batches;
        if (sourceSystem != null && !sourceSystem.isEmpty()) {
            batches = batchRepository.findBySourceSystem(sourceSystem);
        } else if (startTime != null && endTime != null) {
            batches = batchRepository.findByTimeRange(startTime, endTime);
        } else {
            batches = batchRepository.findAll();
        }
        return ApiResponse.success(batches);
    }
}
