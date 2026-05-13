package com.devicecommand.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_execution_confirm")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionConfirm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Column(name = "confirm_no", unique = true, nullable = false, length = 64)
    private String confirmNo;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "confirm_source", length = 32)
    private String confirmSource;

    @Column(name = "confirm_result", length = 16)
    private String confirmResult;

    @Column(name = "result_code", length = 32)
    private String resultCode;

    @Column(name = "result_message", length = 512)
    private String resultMessage;

    @Column(name = "result_detail", length = 2048)
    private String resultDetail;

    @Column(name = "confirm_time", nullable = false)
    private LocalDateTime confirmTime;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
    }
}
