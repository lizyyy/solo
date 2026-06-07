"""演示数据 - 小而真的筛查流程示例"""
from datetime import datetime, timedelta


BASE_TIME = datetime(2026, 6, 5, 14, 30, 0)


MODEL_OUTPUTS_V1 = [
    {
        "sample_id": "SAMPLE-001",
        "model_version": "v1.0",
        "conclusion": "正常样本",
        "confidence": 0.92,
        "output_time": (BASE_TIME - timedelta(hours=2)).isoformat(),
        "raw_fragment": """用户输入：帮我查一下明天北京天气
模型输出：
{
  "intent": "weather_query",
  "city": "北京",
  "date": "明天",
  "confidence": 0.92,
  "quality_score": 0.88
}
模型判断：正常样本，标注质量合格"""
    },
    {
        "sample_id": "SAMPLE-002",
        "model_version": "v1.0",
        "conclusion": "低质样本 - 标注不完整",
        "confidence": 0.78,
        "output_time": (BASE_TIME - timedelta(hours=2) + timedelta(minutes=1)).isoformat(),
        "raw_fragment": """用户输入：推荐一款笔记本
模型输出：
{
  "intent": "product_recommendation",
  "category": "笔记本",
  "confidence": 0.85,
  "quality_score": 0.45
}
标注内容：[{"label":"推荐产品","value":""}]
模型判断：低质样本，标注为空，标注员未填写具体产品"""
    },
    {
        "sample_id": "SAMPLE-003",
        "model_version": "v1.0",
        "conclusion": "低质样本 - 分类错误",
        "confidence": 0.65,
        "output_time": (BASE_TIME - timedelta(hours=2) + timedelta(minutes=2)).isoformat(),
        "raw_fragment": """用户输入：我要投诉你们的服务太差了
模型输出：
{
  "intent": "complaint",
  "confidence": 0.95,
  "quality_score": 0.55
}
标注内容：[{"label":"意图分类","value":"咨询"}]
模型判断：低质样本，用户明确表达投诉，但标注为咨询"""
    }
]


MODEL_OUTPUTS_V2 = [
    {
        "sample_id": "SAMPLE-001",
        "model_version": "v1.1",
        "conclusion": "低质样本 - 标注粒度不够",
        "confidence": 0.82,
        "output_time": BASE_TIME.isoformat(),
        "raw_fragment": """用户输入：帮我查一下明天北京天气
模型输出（v1.1 新版）：
{
  "intent": "weather_query",
  "city": "北京",
  "date": "明天",
  "confidence": 0.92,
  "quality_score": 0.62,
  "granularity_check": "failed"
}
标注内容：[{"label":"天气查询","value":"是"}]
模型判断：低质样本，v1.1新增粒度检查不通过，标注过于简单，未区分实况/预报/预警"""
    },
    {
        "sample_id": "SAMPLE-004",
        "model_version": "v1.1",
        "conclusion": "正常样本",
        "confidence": 0.96,
        "output_time": (BASE_TIME + timedelta(minutes=1)).isoformat(),
        "raw_fragment": """用户输入：附近有什么好吃的川菜馆
模型输出：
{
  "intent": "restaurant_search",
  "cuisine": "川菜",
  "location": "附近",
  "confidence": 0.96,
  "quality_score": 0.91
}
模型判断：正常样本，标注质量合格"""
    }
]


MANUAL_CORRECTIONS_CSV = [
    {
        "样本编号": "SAMPLE-002",
        "改判人": "老唐",
        "改判结论": "正常样本 - 产品名可以留空",
        "改判时间": (BASE_TIME + timedelta(hours=1)).isoformat(),
        "改判原因": "看了原始对话，用户只是泛泛问笔记本，没有具体需求，标注员空着是合理的，不算低质",
        "来源": "人工改判表-群文件6月5日版"
    },
    {
        "样本编号": "SAMPLE-003",
        "改判人": "老唐",
        "改判结论": "维持低质 - 分类确实错了",
        "改判时间": (BASE_TIME + timedelta(hours=1, minutes=5)).isoformat(),
        "改判原因": "确认过了，用户原话就是投诉，标注员标成咨询是错的，这条维持低质",
        "来源": "人工改判表-群文件6月5日版"
    }
]


RERUN_OUTPUTS = [
    {
        "sample_id": "SAMPLE-001",
        "model_version": "v1.2-fix",
        "conclusion": "待人工确认 - 边界情况",
        "confidence": 0.55,
        "output_time": (BASE_TIME + timedelta(hours=3)).isoformat(),
        "raw_fragment": """用户输入：帮我查一下明天北京天气
模型输出（v1.2-fix 粒度算法调整后）：
{
  "intent": "weather_query",
  "city": "北京",
  "date": "明天",
  "confidence": 0.92,
  "quality_score": 0.70,
  "granularity_check": "borderline"
}
模型判断：边界情况，建议人工确认标注粒度是否满足当前业务需求"""
    }
]
