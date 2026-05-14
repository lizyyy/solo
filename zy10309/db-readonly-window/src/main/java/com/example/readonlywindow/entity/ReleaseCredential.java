package com.example.readonlywindow.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "release_credentials")
public class ReleaseCredential {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String credentialCode;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "window_id", nullable = false)
    private FreezeWindow freezeWindow;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id")
    private WriteRequest writeRequest;

    @Column(nullable = false)
    private String issuedTo;

    @Column(nullable = false)
    private String issuedBy;

    @Column(nullable = false)
    private LocalDateTime issuedAt;

    private LocalDateTime validUntil;

    private boolean used;

    private LocalDateTime usedAt;

    private String usedBy;

    @Column(length = 2000)
    private String auditNotes;

    @Version
    private Long version;
}
