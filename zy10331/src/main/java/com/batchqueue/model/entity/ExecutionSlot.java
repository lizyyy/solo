package com.batchqueue.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "execution_slots")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionSlot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private Integer slotNumber;

    @Column
    private Long currentTaskId;

    @Column(length = 64)
    private String currentTaskName;

    @Column
    private Boolean isOccupied;

    @Column
    private LocalDateTime occupiedAt;

    @Column
    private LocalDateTime releasedAt;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        if (isOccupied == null) {
            isOccupied = false;
        }
    }
}
