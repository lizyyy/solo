package com.compensation.repository;

import com.compensation.entity.FailedNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FailedNodeRepository extends JpaRepository<FailedNode, Long> {

    List<FailedNode> findByProcessId(String processId);

    Optional<FailedNode> findByProcessIdAndNodeId(String processId, String nodeId);

    boolean existsByProcessIdAndNodeId(String processId, String nodeId);
}
