import uuid
from datetime import datetime
from .models import Article, BusinessItem, Mapping, Responsible, RiskLevel


class SampleData:
    @staticmethod
    def get_privacy_articles_v1() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-001",
                title="个人信息收集原则",
                content="企业应当遵循合法、正当、必要原则收集个人信息，不得过度收集。收集个人信息应当取得个人同意。",
                version="v1",
                tags=["隐私", "收集", "同意"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-002",
                title="个人信息存储期限",
                content="个人信息的存储期限不应超过实现处理目的所必要的最短时间。",
                version="v1",
                tags=["隐私", "存储"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-003",
                title="个人信息共享要求",
                content="向第三方共享个人信息的，应当向个人告知接收方的名称或者姓名、联系方式、处理目的、处理方式和个人信息的种类，并取得个人的单独同意。",
                version="v1",
                tags=["隐私", "共享", "第三方"]
            )
        ]

    @staticmethod
    def get_privacy_articles_v2() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-001",
                title="个人信息收集原则",
                content="企业应当遵循合法、正当、必要和诚信原则收集个人信息，不得以误导、欺诈、胁迫等方式处理个人信息。收集个人信息应当取得个人同意，且同意应当是自愿、明确、具体。",
                version="v2",
                tags=["隐私", "收集", "同意", "诚信"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-004",
                title="个人信息存储期限",
                content="个人信息的存储期限不应超过实现处理目的所必要的最短时间。期限届满后应当及时删除或匿名化处理。",
                version="v2",
                tags=["隐私", "存储", "删除"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-003",
                title="个人信息共享要求",
                content="向第三方共享个人信息的，应当向个人告知接收方的名称或者姓名、联系方式、处理目的、处理方式和个人信息的种类，并取得个人的单独同意。涉及敏感个人信息的，还应当取得个人的书面同意。",
                version="v2",
                tags=["隐私", "共享", "第三方", "敏感信息"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="PRIV-005",
                title="自动化决策",
                content="利用个人信息进行自动化决策，应当公开自动化决策的规则，不得对个人在交易价格等交易条件上实行不合理的差别待遇。",
                version="v2",
                tags=["隐私", "自动化决策", "算法"]
            )
        ]

    @staticmethod
    def get_finance_articles_v1() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="FIN-001",
                title="财务报告披露要求",
                content="企业应当按照国家统一的会计制度的规定，编制并对外提供财务会计报告。",
                version="v1",
                tags=["财务", "报告", "披露"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="FIN-002",
                title="内部控制制度",
                content="企业应当建立健全内部控制制度，保证会计资料真实、完整。",
                version="v1",
                tags=["财务", "内控"]
            )
        ]

    @staticmethod
    def get_finance_articles_v2() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="FIN-001",
                title="财务报告披露要求",
                content="企业应当按照国家统一的会计制度的规定，编制并对外提供财务会计报告。财务会计报告应当由单位负责人和主管会计工作的负责人、会计机构负责人（会计主管人员）签名并盖章。",
                version="v2",
                tags=["财务", "报告", "披露", "签名"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="FIN-002",
                title="内部控制制度",
                content="企业应当建立健全内部控制制度，保证会计资料真实、完整。企业负责人对本单位的内部控制的有效性负责。",
                version="v2",
                tags=["财务", "内控", "负责人"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="FIN-003",
                title="内部审计要求",
                content="企业应当设立内部审计机构或者配备内部审计人员，开展内部审计工作。",
                version="v2",
                tags=["财务", "审计"]
            )
        ]

    @staticmethod
    def get_customer_service_articles_v1() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="CS-001",
                title="客服人员着装规范",
                content="客服人员应当统一着装，佩戴工牌，保持仪表整洁。",
                version="v1",
                tags=["客服", "着装"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="CS-002",
                title="投诉处理时限",
                content="对于客户投诉，应当在7个工作日内予以答复。",
                version="v1",
                tags=["客服", "投诉", "时限"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="CS-003",
                title="客户信息保密",
                content="客服人员应当对客户信息予以保密，不得泄露。",
                version="v1",
                tags=["客服", "保密"]
            )
        ]

    @staticmethod
    def get_customer_service_articles_v2() -> list:
        return [
            Article(
                id=str(uuid.uuid4()),
                number="CS-001",
                title="客服人员着装规范",
                content="客服人员应当统一着装，佩戴工牌，保持仪表整洁。",
                version="v2",
                tags=["客服", "着装"]
            ),
            Article(
                id=str(uuid.uuid4()),
                number="CS-004",
                title="投诉处理时限",
                content="对于客户投诉，应当在3个工作日内予以答复，复杂投诉可以延长至7个工作日，但最长不超过15个工作日。",
                version="v2",
                tags=["客服", "投诉", "时限"]
            )
        ]

    @staticmethod
    def get_business_items() -> list:
        return [
            BusinessItem(
                id=str(uuid.uuid4()),
                name="用户注册",
                code="BUS-001",
                department="产品部",
                risk_level=RiskLevel.HIGH,
                tags=["注册", "用户"]
            ),
            BusinessItem(
                id=str(uuid.uuid4()),
                name="数据共享平台",
                code="BUS-002",
                department="技术部",
                risk_level=RiskLevel.HIGH,
                tags=["数据", "共享"]
            ),
            BusinessItem(
                id=str(uuid.uuid4()),
                name="推荐算法",
                code="BUS-003",
                department="算法部",
                risk_level=RiskLevel.MEDIUM,
                tags=["算法", "推荐"]
            ),
            BusinessItem(
                id=str(uuid.uuid4()),
                name="财务报表系统",
                code="BUS-005",
                department="财务部",
                risk_level=RiskLevel.HIGH,
                tags=["财务", "报表"]
            ),
            BusinessItem(
                id=str(uuid.uuid4()),
                name="客服热线",
                code="BUS-006",
                department="客服部",
                risk_level=RiskLevel.MEDIUM,
                tags=["客服", "热线"]
            ),
            BusinessItem(
                id=str(uuid.uuid4()),
                name="内部审计",
                code="BUS-007",
                department="审计部",
                risk_level=RiskLevel.HIGH,
                tags=["审计", "内控"]
            )
        ]

    @staticmethod
    def get_mappings() -> list:
        return [
            Mapping(article_number="PRIV-001", business_code="BUS-001"),
            Mapping(article_number="PRIV-003", business_code="BUS-002"),
            Mapping(article_number="PRIV-005", business_code="BUS-003"),
            Mapping(article_number="FIN-001", business_code="BUS-005"),
            Mapping(article_number="FIN-002", business_code="BUS-005"),
            Mapping(article_number="FIN-003", business_code="BUS-007"),
            Mapping(article_number="CS-002", business_code="BUS-006"),
            Mapping(article_number="CS-004", business_code="BUS-006")
        ]

    @staticmethod
    def get_responsibles() -> list:
        return [
            Responsible(
                code="R-001",
                name="张三",
                role="产品合规负责人",
                department="产品部",
                email="zhangsan@example.com"
            ),
            Responsible(
                code="R-002",
                name="李四",
                role="技术合规负责人",
                department="技术部",
                email="lisi@example.com"
            ),
            Responsible(
                code="R-003",
                name="王五",
                role="财务负责人",
                department="财务部",
                email="wangwu@example.com"
            ),
            Responsible(
                code="R-004",
                name="赵六",
                role="客服负责人",
                department="客服部",
                email="zhaoliu@example.com"
            )
        ]
