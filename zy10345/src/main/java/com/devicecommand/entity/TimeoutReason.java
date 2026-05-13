package com.devicecommand.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_timeout_reason")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimeoutReason {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "timeout_type", length = 32)
    private String timeoutType;

    @Column(name = "reason_code", length = 32)
    private String reasonCode;

    @Column(name = "reason_description", length = 512)
    private String reasonDescription;

    @Column(name = "detail_info", length = 2048)
    private String detailInfo;

    @Column(name = "detect_time", nullable = false)
    private LocalDateTime detectTime;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
    }
}
