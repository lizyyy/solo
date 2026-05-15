package com.resource.tag.repository;

import com.resource.tag.model.ResourceNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ResourceNodeRepository extends JpaRepository<ResourceNode, Long> {
    Optional<ResourceNode> findByNodeId(String nodeId);
    boolean existsByNodeId(String nodeId);
}
