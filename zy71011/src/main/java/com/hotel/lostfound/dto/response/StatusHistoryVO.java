package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.LostItemStatus;

import java.time.LocalDateTime;

public class StatusHistoryVO {

    private Long id;

    private LostItemStatus fromStatus;

    private LostItemStatus toStatus;

    private String operator;

    private String remark;

    private LocalDateTime operateTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LostItemStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(LostItemStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public LostItemStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(LostItemStatus toStatus) {
        this.toStatus = toStatus;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public LocalDateTime getOperateTime() {
        return operateTime;
    }

    public void setOperateTime(LocalDateTime operateTime) {
        this.operateTime = operateTime;
    }
}
