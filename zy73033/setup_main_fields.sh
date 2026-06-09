#!/bin/bash
BASE=Fj4jbNvHaado6JsbEFgci9XMnJu
TABLE=tblUcXaYYXNDsKfP
CMD="lark-cli base +field-create --base-token $BASE --table-id $TABLE"

set -e

echo "=== 创建字段: 宠物姓名"
$CMD --json '{"name":"宠物姓名","type":"text"}'

echo "=== 创建字段: 主人姓名"
$CMD --json '{"name":"主人姓名","type":"text"}'

echo "=== 创建字段: 主人联系方式"
$CMD --json '{"name":"主人联系方式","type":"text","style":{"type":"phone"}}'

echo "=== 创建字段: 课程名称"
$CMD --json '{"name":"课程名称","type":"text"}'

echo "=== 创建字段: 训练课程节次"
$CMD --json '{"name":"训练课程节次","type":"number","style":{"type":"plain","precision":0}}'

echo "=== 创建字段: 上课日期"
$CMD --json '{"name":"上课日期","type":"datetime","style":{"format":"yyyy-MM-dd"}}'

echo "=== 创建字段: 训练内容"
$CMD --json '{"name":"训练内容","type":"text"}'

echo "=== 创建字段: 训练表现"
$CMD --json '{"name":"训练表现","type":"text"}'

echo "=== 创建字段: 课后作业"
$CMD --json '{"name":"课后作业","type":"text"}'

echo "=== 创建字段: 疫苗接种日期"
$CMD --json '{"name":"疫苗接种日期","type":"datetime","style":{"format":"yyyy-MM-dd"}}'

echo "=== 创建字段: 数据来源"
$CMD --json '{"name":"数据来源","type":"select","multiple":false,"options":[{"name":"系统导入","hue":"Blue","lightness":"Lighter"},{"name":"人工录入","hue":"Green","lightness":"Lighter"},{"name":"微信同步","hue":"Purple","lightness":"Lighter"},{"name":"历史迁移","hue":"Gray","lightness":"Lighter"}]}'

echo "=== 创建字段: 处理状态"
$CMD --json '{"name":"处理状态","type":"select","multiple":false,"options":[{"name":"待处理","hue":"Orange","lightness":"Lighter"},{"name":"已处理","hue":"Green","lightness":"Standard"},{"name":"待补材料","hue":"Red","lightness":"Lighter"},{"name":"人工改判","hue":"Purple","lightness":"Lighter"},{"name":"异常","hue":"Red","lightness":"Standard"}]}'

echo "=== 创建字段: 微信备注原始字段名"
$CMD --json '{"name":"微信备注原始字段名","type":"text"}'

echo "=== 创建字段: 主人微信备注"
$CMD --json '{"name":"主人微信备注","type":"text"}'

echo "=== 创建字段: 人工备注保护标记"
$CMD --json '{"name":"人工备注保护标记","type":"checkbox"}'

echo "=== 创建字段: 创建时间"
$CMD --json '{"name":"创建时间","type":"created_at","style":{"format":"yyyy-MM-dd HH:mm"}}'

echo "=== 创建字段: 更新时间"
$CMD --json '{"name":"更新时间","type":"updated_at","style":{"format":"yyyy-MM-dd HH:mm"}}'

echo "=== 创建字段: 创建人"
$CMD --json '{"name":"创建人","type":"created_by"}'

echo "=== 创建字段: 更新人"
$CMD --json '{"name":"更新人","type":"updated_by"}'

echo "=== 创建公式字段: 唯一去重键"
$CMD --json '{"name":"唯一去重键","type":"formula","expression":"CONCATENATE([宠物姓名],\"_\",[主人姓名],\"_\",TEXT([上课日期],\"YYYYMMDD\"))"}' --i-have-read-guide

echo "=== 创建公式字段: 疫苗缺失标记"
$CMD --json '{"name":"疫苗缺失标记","type":"formula","expression":"IF(ISBLANK([疫苗接种日期]),\"缺失\",\"正常\")"}' --i-have-read-guide

echo "=== 所有字段创建完成"
