package com.edge.config.ack.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.edge.config.ack.common.ErrorCode;
import com.edge.config.ack.common.Result;
import com.edge.config.ack.dto.*;
import com.edge.config.ack.entity.*;
import com.edge.config.ack.enums.*;
import com.edge.config.ack.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfigDeliveryService {
    private final ConfigDeliveryMapper deliveryMapper;
    private final EdgeNodeMapper nodeMapper;
    private final ConfigVersionMapper versionMapper;
    private final AckReceiptMapper receiptMapper;
    private final EffectiveCheckMapper checkMapper;
    private final FailureReasonMapper failureMapper;
    private final RetryTaskMapper retryTaskMapper;

    private final ConcurrentHashMap<String, Boolean> idempotentCache = new ConcurrentHashMap<>();

    @Transactional(rollbackFor = Exception.class)
    public Result<ConfigDelivery> createDelivery(DeliveryCreateReq req, HttpServletRequest request) {
        if (req.getIdempotentKey() != null) {
            if (idempotentCache.putIfAbsent(req.getIdempotentKey(), Boolean.TRUE) != null) {
                return Result.fail(ErrorCode.IDEMPOTENT_KEY_EXIST);
            }
        }

        EdgeNode node = nodeMapper.selectOne(
                new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getNodeCode, req.getNodeCode())
        );
        if (node == null) {
            return Result.fail(ErrorCode.NODE_NOT_EXIST);
        }

        ConfigVersion version = versionMapper.selectOne(
                new LambdaQueryWrapper<ConfigVersion>().eq(ConfigVersion::getVersionNo, req.getVersionNo())
        );
        if (version == null) {
            return Result.fail(ErrorCode.VERSION_NOT_EXIST);
        }

        ConfigDelivery exist = deliveryMapper.selectOne(
                new LambdaQueryWrapper<ConfigDelivery>()
                        .eq(ConfigDelivery::getNodeCode, req.getNodeCode())
                        .eq(ConfigDelivery::getVersionNo, req.getVersionNo())
        );
        if (exist != null) {
            return Result.fail(ErrorCode.DUPLICATE_DELIVERY);
        }

        ConfigDelivery delivery = new ConfigDelivery();
        delivery.setDeliveryNo("DLV" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        delivery.setNodeId(node.getId());
        delivery.setNodeCode(node.getNodeCode());
        delivery.setVersionId(version.getId());
        delivery.setVersionNo(version.getVersionNo());
        delivery.setDeliveryTime(LocalDateTime.now());
        delivery.setStatus(DeliveryStatusEnum.PENDING_ACK.getCode());
        delivery.setRetryCount(0);
        deliveryMapper.insert(delivery);

        return Result.success(delivery);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<AckReceipt> ackDelivery(DeliveryAckReq req, HttpServletRequest request) {
        if (req.getIdempotentKey() != null) {
            if (idempotentCache.putIfAbsent(req.getIdempotentKey(), Boolean.TRUE) != null) {
                AckReceipt receipt = receiptMapper.selectOne(
                        new LambdaQueryWrapper<AckReceipt>().eq(AckReceipt::getDeliveryNo, req.getDeliveryNo())
                );
                return Result.success(receipt);
            }
        }

        ConfigDelivery delivery = deliveryMapper.selectOne(
                new LambdaQueryWrapper<ConfigDelivery>().eq(ConfigDelivery::getDeliveryNo, req.getDeliveryNo())
        );
        if (delivery == null) {
            return Result.fail(ErrorCode.DELIVERY_NOT_EXIST);
        }

        if (!delivery.getStatus().equals(DeliveryStatusEnum.PENDING_ACK.getCode())
                && !delivery.getStatus().equals(DeliveryStatusEnum.ACK_FAILED.getCode())) {
            return Result.fail(ErrorCode.ACK_NOT_ALLOWED);
        }

        AckResultEnum resultEnum = AckResultEnum.of(req.getAckResult());
        if (resultEnum == null) {
            return Result.fail(ErrorCode.PARAM_ERROR);
        }

        AckReceipt receipt = new AckReceipt();
        receipt.setReceiptNo("RCP" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        receipt.setDeliveryId(delivery.getId());
        receipt.setDeliveryNo(delivery.getDeliveryNo());
        receipt.setNodeId(delivery.getNodeId());
        receipt.setNodeCode(delivery.getNodeCode());
        receipt.setVersionId(delivery.getVersionId());
        receipt.setVersionNo(delivery.getVersionNo());
        receipt.setAckResult(req.getAckResult());
        receipt.setAckTime(LocalDateTime.now());
        receipt.setAckBy(req.getAckBy());
        receipt.setClientIp(getClientIp(request));
        receiptMapper.insert(receipt);

        if (resultEnum == AckResultEnum.SUCCESS) {
            delivery.setStatus(DeliveryStatusEnum.ACKED.getCode());
            delivery.setAckTime(LocalDateTime.now());
        } else {
            delivery.setStatus(DeliveryStatusEnum.ACK_FAILED.getCode());
            createFailureRecord(delivery, FailureTypeEnum.ACK_FAILED, req.getFailureCode(), req.getFailureMsg(), req.getFailureDetail());
            createRetryTask(delivery, RetryTypeEnum.REDO_DELIVERY);
        }
        deliveryMapper.updateById(delivery);

        return Result.success(receipt);
    }

    @Transactional(rollbackFor = Exception.class)
    public Result<EffectiveCheck> effectiveCheck(EffectiveCheckReq req) {
        ConfigDelivery delivery = deliveryMapper.selectOne(
                new LambdaQueryWrapper<ConfigDelivery>().eq(ConfigDelivery::getDeliveryNo, req.getDeliveryNo())
        );
        if (delivery == null) {
            return Result.fail(ErrorCode.DELIVERY_NOT_EXIST);
        }

        if (!delivery.getStatus().equals(DeliveryStatusEnum.ACKED.getCode())
                && !delivery.getStatus().equals(DeliveryStatusEnum.EFFECT_FAILED.getCode())) {
            return Result.fail(ErrorCode.CHECK_NOT_ALLOWED);
        }

        CheckResultEnum resultEnum = CheckResultEnum.of(req.getCheckResult());
        if (resultEnum == null) {
            return Result.fail(ErrorCode.PARAM_ERROR);
        }

        EffectiveCheck check = new EffectiveCheck();
        check.setDeliveryId(delivery.getId());
        check.setDeliveryNo(delivery.getDeliveryNo());
        check.setNodeId(delivery.getNodeId());
        check.setNodeCode(delivery.getNodeCode());
        check.setVersionId(delivery.getVersionId());
        check.setVersionNo(delivery.getVersionNo());
        check.setCheckTime(LocalDateTime.now());
        check.setCheckResult(req.getCheckResult());
        check.setCheckDetail(req.getCheckDetail());
        check.setCheckBy(req.getCheckBy());
        checkMapper.insert(check);

        if (resultEnum == CheckResultEnum.SUCCESS) {
            delivery.setStatus(DeliveryStatusEnum.EFFECTED.getCode());
            delivery.setEffectiveTime(LocalDateTime.now());
        } else if (resultEnum == CheckResultEnum.FAILED) {
            delivery.setStatus(DeliveryStatusEnum.EFFECT_FAILED.getCode());
            createFailureRecord(delivery, FailureTypeEnum.EFFECT_FAILED, req.getFailureCode(), req.getFailureMsg(), req.getFailureDetail());
            createRetryTask(delivery, RetryTypeEnum.REDO_CHECK);
        } else {
            delivery.setStatus(DeliveryStatusEnum.EFFECTING.getCode());
        }
        deliveryMapper.updateById(delivery);

        return Result.success(check);
    }

    public Result<IPage<ConfigDelivery>> queryDelivery(DeliveryQueryReq req) {
        LambdaQueryWrapper<ConfigDelivery> wrapper = new LambdaQueryWrapper<>();
        if (req.getNodeCode() != null) {
            wrapper.eq(ConfigDelivery::getNodeCode, req.getNodeCode());
        }
        if (req.getVersionNo() != null) {
            wrapper.eq(ConfigDelivery::getVersionNo, req.getVersionNo());
        }
        if (req.getStatus() != null) {
            wrapper.eq(ConfigDelivery::getStatus, req.getStatus());
        }
        if (req.getStartTime() != null) {
            wrapper.ge(ConfigDelivery::getCreatedTime, req.getStartTime());
        }
        if (req.getEndTime() != null) {
            wrapper.le(ConfigDelivery::getCreatedTime, req.getEndTime());
        }
        wrapper.orderByDesc(ConfigDelivery::getCreatedTime);

        Page<ConfigDelivery> page = new Page<>(req.getPageNum(), req.getPageSize());
        IPage<ConfigDelivery> result = deliveryMapper.selectPage(page, wrapper);
        return Result.success(result);
    }

    public Result<ConfigDelivery> getDeliveryDetail(String deliveryNo) {
        ConfigDelivery delivery = deliveryMapper.selectOne(
                new LambdaQueryWrapper<ConfigDelivery>().eq(ConfigDelivery::getDeliveryNo, deliveryNo)
        );
        if (delivery == null) {
            return Result.fail(ErrorCode.DELIVERY_NOT_EXIST);
        }
        return Result.success(delivery);
    }

    public Result<List<AckReceipt>> getReceiptHistory(String deliveryNo) {
        List<AckReceipt> list = receiptMapper.selectList(
                new LambdaQueryWrapper<AckReceipt>()
                        .eq(AckReceipt::getDeliveryNo, deliveryNo)
                        .orderByDesc(AckReceipt::getCreatedTime)
        );
        return Result.success(list);
    }

    public Result<List<FailureReason>> getFailureHistory(String deliveryNo) {
        List<FailureReason> list = failureMapper.selectList(
                new LambdaQueryWrapper<FailureReason>()
                        .eq(FailureReason::getDeliveryNo, deliveryNo)
                        .orderByDesc(FailureReason::getCreatedTime)
        );
        return Result.success(list);
    }

    public Result<List<ReconciliationResult>> reconciliation(String versionNo) {
        List<ConfigDelivery> deliveries = deliveryMapper.selectList(
                new LambdaQueryWrapper<ConfigDelivery>().eq(ConfigDelivery::getVersionNo, versionNo)
        );

        List<EdgeNode> allNodes = nodeMapper.selectList(
                new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getStatus, 1)
        );

        List<ReconciliationResult> results = new ArrayList<>();
        for (EdgeNode node : allNodes) {
            ReconciliationResult result = new ReconciliationResult();
            result.setNodeCode(node.getNodeCode());
            result.setVersionNo(versionNo);
            result.setExpectedStatus(DeliveryStatusEnum.EFFECTED.getCode());

            ConfigDelivery delivery = deliveries.stream()
                    .filter(d -> d.getNodeCode().equals(node.getNodeCode()))
                    .findFirst()
                    .orElse(null);

            if (delivery == null) {
                result.setActualStatus(null);
                result.setIsMatch(false);
                result.setRemark("配置未下发");
            } else {
                result.setActualStatus(delivery.getStatus());
                result.setIsMatch(delivery.getStatus().equals(DeliveryStatusEnum.EFFECTED.getCode()));
                if (!result.getIsMatch()) {
                    result.setRemark("状态不匹配，当前:" + DeliveryStatusEnum.of(delivery.getStatus()).getDesc());
                } else {
                    result.setRemark("匹配");
                }
            }
            results.add(result);
        }
        return Result.success(results);
    }

    private void createFailureRecord(ConfigDelivery delivery, FailureTypeEnum type, String code, String msg, String detail) {
        FailureReason failure = new FailureReason();
        failure.setDeliveryId(delivery.getId());
        failure.setDeliveryNo(delivery.getDeliveryNo());
        failure.setNodeId(delivery.getNodeId());
        failure.setNodeCode(delivery.getNodeCode());
        failure.setVersionId(delivery.getVersionId());
        failure.setVersionNo(delivery.getVersionNo());
        failure.setFailureType(type.getCode());
        failure.setFailureCode(code);
        failure.setFailureMsg(msg);
        failure.setFailureDetail(detail);
        failure.setFailureTime(LocalDateTime.now());
        failureMapper.insert(failure);
    }

    private void createRetryTask(ConfigDelivery delivery, RetryTypeEnum type) {
        RetryTask task = new RetryTask();
        task.setTaskNo("TSK" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        task.setDeliveryId(delivery.getId());
        task.setDeliveryNo(delivery.getDeliveryNo());
        task.setNodeId(delivery.getNodeId());
        task.setNodeCode(delivery.getNodeCode());
        task.setVersionId(delivery.getVersionId());
        task.setVersionNo(delivery.getVersionNo());
        task.setRetryType(type.getCode());
        task.setRetryCount(0);
        task.setMaxRetry(3);
        task.setNextRetryTime(LocalDateTime.now().plusMinutes(5));
        task.setStatus(RetryStatusEnum.PENDING.getCode());
        retryTaskMapper.insert(task);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.length() == 0 || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
}
