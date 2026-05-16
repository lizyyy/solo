package com.statuspage.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "confirmations", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"incident_id", "announcement_id", "subscriber_id"})
})
public class Confirmation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private Incident incident;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "announcement_id", nullable = false)
    private Announcement announcement;

    @Column(nullable = false)
    private String subscriberId;

    private String subscriberName;

    @Column(nullable = false)
    private LocalDateTime confirmedAt = LocalDateTime.now();

    @Column(length = 500)
    private String note;

    private String confirmedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}