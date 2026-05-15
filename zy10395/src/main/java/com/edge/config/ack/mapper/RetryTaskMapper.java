package com.edge.config.ack.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.edge.config.ack.entity.RetryTask;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RetryTaskMapper extends BaseMapper<RetryTask> {
}
