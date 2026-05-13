package com.schema.approval.entity;

import com.schema.approval.enums.SchemaStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "schema_version", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"topic_id", "version"})
})
public class SchemaVersion extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id", nullable = false)
    private EventTopic topic;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "schema_content", nullable = false, columnDefinition = "TEXT")
    private String schemaContent;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SchemaStatus status = SchemaStatus.DRAFT;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "request_id", unique = true)
    private String requestId;

    @Column(name = "is_latest", nullable = false)
    private Boolean isLatest = false;

    @Column(name = "is_published", nullable = false)
    private Boolean isPublished = false;
}
