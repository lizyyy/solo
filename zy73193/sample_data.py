SAMPLE_QUESTIONS = [
    {
        "qid": "Q001_v2024",
        "title": "数列递推与收敛性分析",
        "original_text": "设数列 {x_n} 满足递推关系 x_{n+1} = (2·x_n + 1) / (1 + x_n)，x_0 = 3。\n请分析数列的收敛性，并给出前20项数值。单位：初始值单位为米(m)，最终结果换算为厘米(cm)。",
        "version": "2024版",
        "source_file": "题目清单_2024.xlsx",
        "difficulty": "难",
        "tags": ["递推", "收敛", "单位换算"]
    },
    {
        "qid": "Q001_v2023",
        "title": "数列递推与收敛性分析",
        "original_text": "设数列 {x_n} 满足递推关系 x_{n+1} = (2·x_n + 1) / (1 + x_n)，x_0 = 3。\n请分析数列的收敛性，并给出前15项数值。单位统一为米。",
        "version": "2023版",
        "source_file": "题目清单_2023_旧版.xlsx",
        "difficulty": "难",
        "tags": ["递推", "收敛"]
    },
    {
        "qid": "Q002",
        "title": "简单线性递推",
        "original_text": "数列 x_{n+1} = 0.5·x_n + 2，初值 x_0 = 10。求前10项。",
        "version": "2024版",
        "source_file": "题目清单_2024.xlsx",
        "difficulty": "易",
        "tags": ["线性递推"]
    }
]

SAMPLE_MATERIALS = [
    {
        "mid": "M001",
        "current_name": "建模助教答案集_v3.pdf",
        "previous_names": ["建模助教答案集_v2.pdf", "参考答案_临时.pdf"],
        "renamed_by": "现场老师",
        "rename_time": "2026-06-18 14:30",
        "content": "包含Q001 2024版的详细解答和单位换算说明",
        "source_type": "answer",
        "linked_qids": ["Q001_v2024"],
        "is_temporary_rename": True
    },
    {
        "mid": "M002",
        "current_name": "2023旧版标准答案.pdf",
        "previous_names": [],
        "renamed_by": "",
        "rename_time": "",
        "content": "2023版题目解答，单位未换算",
        "source_type": "answer",
        "linked_qids": ["Q001_v2023"],
        "is_temporary_rename": False
    },
    {
        "mid": "M003",
        "current_name": "题目Q002讲解",
        "previous_names": [],
        "renamed_by": "",
        "rename_time": "",
        "content": "线性递推基础讲解",
        "source_type": "explanation",
        "linked_qids": ["Q002"],
        "is_temporary_rename": False
    }
]

SAMPLE_ANSWERS = [
    {
        "aid": "A001",
        "qid": "Q001_v2024",
        "material_mid": "M001",
        "version": "v3",
        "answer_text": "递推式 x_{n+1} = (2·x_n + 1) / (1 + x_n)，x_0 = 3m。按1m=100cm换算。",
        "processed_result": "x_n 收敛到 1.618...（黄金比，单位 cm：161.8 cm）。前20项已在截图中列出。",
        "unit_conversion": "输入单位 m → 计算单位 m → 输出 ×100 → cm；1m = 100cm",
        "params": {"length": 20, "a": 2.0, "b": 1.0, "c_divisor": 1.0, "x0": 3.0}
    },
    {
        "aid": "A002",
        "qid": "Q001_v2023",
        "material_mid": "M002",
        "version": "2023std",
        "answer_text": "递推式 x_{n+1} = (2·x_n + 1) / (1 + x_n)，x_0 = 3，单位为米。",
        "processed_result": "x_n 收敛到约 1.618（单位 m）。给出前15项。",
        "unit_conversion": "无换算，单位始终为 m",
        "params": {"length": 15, "a": 2.0, "b": 1.0, "c_divisor": 1.0, "x0": 3.0}
    },
    {
        "aid": "A003",
        "qid": "Q002",
        "material_mid": "M003",
        "version": "v1",
        "answer_text": "x_{n+1} = 0.5 x_n + 2，x_0 = 10",
        "processed_result": "收敛到 4。",
        "unit_conversion": "",
        "params": {"length": 10, "a": 0.5, "b": 2.0, "c_divisor": 0.0, "x0": 10.0}
    }
]

SAMPLE_NOTES = [
    {
        "nid": "note_001",
        "target_type": "question",
        "target_id": "Q001_v2024",
        "content": "现场老师口头说：这次Q001的单位一定注意要从m换算到cm，旧版题目没提这个。",
        "note_type": "verbal",
        "author": "小岑",
        "timestamp": "2026-06-19 09:15:22",
        "attachments": []
    },
    {
        "nid": "note_002",
        "target_type": "material",
        "target_id": "M001",
        "content": "截图说明：答案集v3把c_divisor从2改成了1，是老师上周临时改的，口头通知未更新文档标题。",
        "note_type": "screenshot",
        "author": "小岑",
        "timestamp": "2026-06-19 10:02:11",
        "attachments": [{"type": "screenshot", "name": "v3改动截图.png"}]
    },
    {
        "nid": "note_003",
        "target_type": "answer",
        "target_id": "A001",
        "content": "小岑备注：除零检查要留意，c_divisor+x_n不能为0，在x_n=-1附近会出问题。",
        "note_type": "internal",
        "author": "小岑",
        "timestamp": "2026-06-19 11:30:05",
        "attachments": []
    }
]

SAMPLE_PARAM_SETS = [
    {
        "pid": "ps_A001_2024",
        "name": "2024版Q001 (m→cm)",
        "qid": "Q001_v2024",
        "aid": "A001",
        "params": {"length": 20, "a": 2.0, "b": 1.0, "c_divisor": 1.0, "x0": 3.0},
        "unit_config": {"input": "m", "output": "cm", "scale_input": 1.0, "scale_output": 100.0},
        "sequence": []
    },
    {
        "pid": "ps_A002_2023",
        "name": "2023旧版Q001 (m)",
        "qid": "Q001_v2023",
        "aid": "A002",
        "params": {"length": 15, "a": 2.0, "b": 1.0, "c_divisor": 1.0, "x0": 3.0},
        "unit_config": {"input": "m", "output": "m", "scale_input": 1.0, "scale_output": 1.0},
        "sequence": []
    },
    {
        "pid": "ps_div0_demo",
        "name": "除零演示 (x_n→-1)",
        "qid": "Q001_v2024",
        "aid": "A001",
        "params": {"length": 10, "a": 1.0, "b": 0.0, "c_divisor": 1.0, "x0": -1.0},
        "unit_config": {"input": "", "output": "", "scale_input": 1.0, "scale_output": 1.0},
        "sequence": []
    }
]
