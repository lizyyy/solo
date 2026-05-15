package com.observability.tagvalidation.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "tag_key", indexes = {
    @Index(name = "idx_tag_key_name", columnList = "keyName"),
    @Index(name = "idx_api_info_id", columnList = "api_info_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = "apiInfo")
public class TagKey extends BaseEntity {
    @Column(name = "key_name", nullable = false, length = 128)
    private String keyName;

    @Column(name = "description", length = 512)
    private String description;

    @Column(name = "required", nullable = false)
    private Boolean required = false;

    @Column(name = "value_pattern", length = 256)
    private String valuePattern;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_info_id", nullable = false)
    private ApiInfo apiInfo;

    @OneToMany(mappedBy = "tagKey", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AllowedValue> allowedValues = new ArrayList<>();
}
