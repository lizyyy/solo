package com.identity.verification.repository;

import com.identity.verification.model.PersonIdentifier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PersonIdentifierRepository extends JpaRepository<PersonIdentifier, Long> {

    List<PersonIdentifier> findByTaskId(Long taskId);
}
