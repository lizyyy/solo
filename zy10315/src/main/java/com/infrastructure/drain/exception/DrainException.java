package com.infrastructure.drain.exception;

import com.infrastructure.drain.model.DrainStatus;
import lombok.Getter;

@Getter
public class DrainException extends RuntimeException {
    private final Integer code;
    private final String batchId;
    private final DrainStatus currentStatus;

    public DrainException(Integer code, String message) {
        super(message);
        this.code = code;
        this.batchId = null;
        this.currentStatus = null;
    }

    public DrainException(Integer code, String message, String batchId) {
        super(message);
        this.code = code;
        this.batchId = batchId;
        this.currentStatus = null;
    }

    public DrainException(Integer code, String message, String batchId, DrainStatus currentStatus) {
        super(message);
        this.code = code;
        this.batchId = batchId;
        this.currentStatus = currentStatus;
    }

    public static DrainException batchNotFound(String batchId) {
        return new DrainException(404, "批次不存在: " + batchId, batchId);
    }

    public static DrainException batchAlreadyExists(String batchId) {
        return new DrainException(409, "批次已存在: " + batchId, batchId);
    }

    public static DrainException invalidStatusTransition(String batchId, DrainStatus current, DrainStatus target) {
        return new DrainException(400, 
            String.format("批次[%s]状态不允许跳转: %s -> %s", batchId, current, target), 
            batchId, current);
    }

    public static DrainException instanceInOtherBatch(String instanceId, String batchId) {
        return new DrainException(409, 
            String.format("实例[%s]已在批次[%s]中", instanceId, batchId), 
            batchId);
    }

    public static DrainException batchAlreadyCompleted(String batchId) {
        return new DrainException(409, "批次已完成，不能再修改: " + batchId, batchId);
    }
}
