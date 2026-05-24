package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
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
}
