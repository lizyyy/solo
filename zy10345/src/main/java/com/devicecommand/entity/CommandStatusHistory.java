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
@Table(name = "t_command_status_history")
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
        if (changeTime == null) {
            changeTime = LocalDateTime.now();
        }
    }
}
