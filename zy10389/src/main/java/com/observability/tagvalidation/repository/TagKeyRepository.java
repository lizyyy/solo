package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.TagKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagKeyRepository extends JpaRepository<TagKey, Long> {
    List<TagKey> findByApiInfoId(Long apiInfoId);
    Optional<TagKey> findByApiInfoIdAndKeyName(Long apiInfoId, String keyName);
    boolean existsByApiInfoIdAndKeyName(Long apiInfoId, String keyName);
}
