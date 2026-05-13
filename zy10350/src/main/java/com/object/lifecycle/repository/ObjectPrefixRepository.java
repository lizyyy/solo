package com.object.lifecycle.repository;

import com.object.lifecycle.entity.ObjectPrefix;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ObjectPrefixRepository extends JpaRepository<ObjectPrefix, Long> {

    Optional<ObjectPrefix> findByPrefixAndBucketName(String prefix, String bucketName);

    List<ObjectPrefix> findByEnabledTrue();
}
