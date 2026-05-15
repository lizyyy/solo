package com.devicecommand.entity;

import com.devicecommand.enums.CommandStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_command_status_history")
public class CommandStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 32)
    private CommandStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 32)
    private CommandStatus toStatus;

    @Column(name = "change_reason", length = 512)
    private String changeReason;

    @Column(name = "change_time", nullable = false)
    private LocalDateTime changeTime;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
        if (changeTime == null) changeTime = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public CommandStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(CommandStatus fromStatus) { this.fromStatus = fromStatus; }
    public CommandStatus getToStatus() { return toStatus; }
    public void setToStatus(CommandStatus toStatus) { this.toStatus = toStatus; }
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    public LocalDateTime getChangeTime() { return changeTime; }
    public void setChangeTime(LocalDateTime changeTime) { this.changeTime = changeTime; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
