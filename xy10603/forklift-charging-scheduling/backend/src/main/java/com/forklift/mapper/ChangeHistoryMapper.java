package com.forklift.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.forklift.entity.ChangeHistory;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChangeHistoryMapper extends BaseMapper<ChangeHistory> {
}
