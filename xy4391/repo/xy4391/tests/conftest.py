import pytest
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models import Interview, InterviewVersion, InterviewSummary, Authorization, AuditLog

@pytest.fixture
def app():
    """创建测试应用"""
    app = create_app('testing')
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """创建测试客户端"""
    return app.test_client()

@pytest.fixture
def runner(app):
    """创建测试CLI运行器"""
    return app.test_cli_runner()

@pytest.fixture
def sample_interview_data():
    """示例访谈数据"""
    return {
        "interview_id": "TEST-001",
        "date": "2026-04-15",
        "researcher": "张研究员",
        "topic": "用户体验测试",
        "respondent_info": {
            "name": "测试用户",
            "phone": "13812345678",
            "email": "test@example.com",
            "company": "测试科技有限公司",
            "address": "北京市海淀区测试路1号"
        },
        "conversations": [
            {
                "id": 1,
                "speaker": "研究员",
                "content": "你好，测试用户，感谢你参加我们的测试。"
            },
            {
                "id": 2,
                "speaker": "受访者",
                "content": "你好，张研究员。我叫测试用户，在测试科技有限公司工作。"
            }
        ]
    }

@pytest.fixture
def sample_sensitive_text():
    """包含敏感信息的示例文本"""
    return """
    你好，我叫李明，我的手机号是13812345678，邮箱是liming@example.com。
    我在北京市海淀区中关村科技有限公司工作，公司地址是北京市海淀区中关村大街1号。
    我的身份证号是110101199001011234。
    """
