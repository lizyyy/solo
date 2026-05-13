package com.devicecommand.repository;

import com.devicecommand.entity.DispatchChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DispatchChannelRepository extends JpaRepository<DispatchChannel, Long> {

    Optional<DispatchChannel> findByChannelCode(String channelCode);

    boolean existsByChannelCode(String channelCode);
}
