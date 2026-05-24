package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "status_histories")
public class StatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false)
    private LostItem lostItem;

    @Enumerated(EnumType.STRING)
    private LostItemStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LostItemStatus toStatus;

    @Column(nullable = false, length = 50)
    private String operator;

    @Column(length = 500)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime operateTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LostItem getLostItem() {
        return lostItem;
    }

    public void setLostItem(LostItem lostItem) {
        this.lostItem = lostItem;
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
