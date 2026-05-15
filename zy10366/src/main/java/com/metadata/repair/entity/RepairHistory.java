package com.metadata.repair.entity;

import com.metadata.repair.enums.RepairStatus;
import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "repair_history")
public class RepairHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String batchNo;

    @Enumerated(EnumType.STRING)
    private RepairStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepairStatus newStatus;

    private String operator;

    @Column(length = 2000)
    private String remark;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
