package com.devicecommand.entity;

import com.devicecommand.enums.CommandStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_command_batch")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommandBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_no", unique = true, nullable = false, length = 64)
    private String batchNo;

    @Column(name = "command_code", nullable = false, length = 32)
    private String commandCode;

    @Column(name = "command_name", length = 128)
    private String commandName;

    @Column(name = "command_params", length = 2048)
    private String commandParams;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "channel_id")
    private Long channelId;

    @Column(name = "channel_code", length = 32)
    private String channelCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CommandStatus status;

    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds;

    @Column(name = "max_retry_count", nullable = false)
    private Integer maxRetryCount;

    @Column(name = "current_retry_count", nullable = false)
    private Integer currentRetryCount;

    @Column(name = "dispatch_time")
    private LocalDateTime dispatchTime;

    @Column(name = "expected_confirm_time")
    private LocalDateTime expectedConfirmTime;

    @Column(name = "confirm_time")
    private LocalDateTime confirmTime;

    @Column(name = "result_code", length = 32)
    private String resultCode;

    @Column(name = "result_message", length = 512)
    private String resultMessage;

    @Column(name = "final_conclusion", length = 1024)
    private String finalConclusion;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
        updateTime = LocalDateTime.now();
        if (currentRetryCount == null) {
            currentRetryCount = 0;
        }
        if (maxRetryCount == null) {
            maxRetryCount = 3;
        }
        if (timeoutSeconds == null) {
            timeoutSeconds = 300;
        }
        if (status == null) {
            status = CommandStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updateTime = LocalDateTime.now();
    }
}
