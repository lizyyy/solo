import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from app.models import QuestionType, RiskType

TEST_CASES = {
    "smooth_flow": {
        "description": "顺利流程：三种题型的正常判分样例",
        "cases": [
            {
                "name": "音程题-完全正确-大三度",
                "request": {
                    "student_id": "S001",
                    "question_id": "Q_INT_001",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "C",
                        "upper_note": "E",
                        "interval": {"number": 3, "quality": "major"}
                    },
                    "standard_answer": {
                        "lower_note": "C",
                        "upper_note": "E",
                        "interval": {"number": 3, "quality": "major"}
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 10.0,
                    "is_correct": True,
                    "needs_manual_review": False,
                    "partial_score_count": 4
                }
            },
            {
                "name": "和弦题-完全正确-C大三原位",
                "request": {
                    "student_id": "S001",
                    "question_id": "Q_CHORD_001",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "standard_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 10.0,
                    "is_correct": True,
                    "needs_manual_review": False,
                    "partial_score_count": 4
                }
            },
            {
                "name": "调号题-完全正确-G大调",
                "request": {
                    "student_id": "S001",
                    "question_id": "Q_KEY_001",
                    "question_type": QuestionType.KEY_SIGNATURE.value,
                    "student_answer": {
                        "tonic": "G",
                        "mode": "major",
                        "sharps": 1,
                        "flats": 0
                    },
                    "standard_answer": {
                        "tonic": "G",
                        "mode": "major",
                        "sharps": 1,
                        "flats": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 10.0,
                    "is_correct": True,
                    "needs_manual_review": False,
                    "partial_score_count": 4
                }
            },
            {
                "name": "音程题-部分正确-度数对性质错",
                "request": {
                    "student_id": "S002",
                    "question_id": "Q_INT_002",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "C",
                        "upper_note": "Eb",
                        "interval": {"number": 3, "quality": "major"}
                    },
                    "standard_answer": {
                        "lower_note": "C",
                        "upper_note": "Eb",
                        "interval": {"number": 3, "quality": "minor"}
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 8.0,
                    "is_correct": False,
                    "needs_manual_review": False,
                    "error_count": 1
                }
            },
            {
                "name": "和弦题-部分正确-根音对三音错",
                "request": {
                    "student_id": "S002",
                    "question_id": "Q_CHORD_002",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "notes": ["C", "Eb", "G"],
                        "chord_type": "minor",
                        "inversion": 0
                    },
                    "standard_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score_range": [5.0, 7.0],
                    "is_correct": False,
                    "needs_manual_review": False
                }
            }
        ]
    },
    "boundary_cases": {
        "description": "边界记录：等音误判、部分得分漏算、题型映射错等风险场景",
        "cases": [
            {
                "name": "等音误判-音程题-B#等于C",
                "request": {
                    "student_id": "S003",
                    "question_id": "Q_INT_003",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "B#",
                        "upper_note": "E"
                    },
                    "standard_answer": {
                        "lower_note": "C",
                        "upper_note": "E"
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.ENHARMONIC_MISJUDGE.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "等音误判-和弦题-增六和弦等音",
                "request": {
                    "student_id": "S003",
                    "question_id": "Q_CHORD_003",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "notes": ["C#", "E#", "G#"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "standard_answer": {
                        "notes": ["Db", "F", "Ab"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.ENHARMONIC_MISJUDGE.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "等音误判-调号题-#F等于Gb",
                "request": {
                    "student_id": "S003",
                    "question_id": "Q_KEY_003",
                    "question_type": QuestionType.KEY_SIGNATURE.value,
                    "student_answer": {
                        "tonic": "F#",
                        "mode": "major",
                        "sharps": 6,
                        "flats": 0
                    },
                    "standard_answer": {
                        "tonic": "Gb",
                        "mode": "major",
                        "sharps": 0,
                        "flats": 6
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.ENHARMONIC_MISJUDGE.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "部分得分漏算-音程题缺少interval字段",
                "request": {
                    "student_id": "S004",
                    "question_id": "Q_INT_004",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "C",
                        "upper_note": "G",
                        "interval": {"number": 5}
                    },
                    "standard_answer": {
                        "lower_note": "C",
                        "upper_note": "G",
                        "interval": {"number": 5, "quality": "perfect"}
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.PARTIAL_SCORE_MISS.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "部分得分漏算-和弦题缺少inversion字段",
                "request": {
                    "student_id": "S004",
                    "question_id": "Q_CHORD_004",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "notes": ["E", "G", "C"],
                        "chord_type": "major"
                    },
                    "standard_answer": {
                        "notes": ["E", "G", "C"],
                        "chord_type": "major",
                        "inversion": 1
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.PARTIAL_SCORE_MISS.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "题型映射错-用音程题格式回答和弦题",
                "request": {
                    "student_id": "S005",
                    "question_id": "Q_CHORD_005",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "lower_note": "C",
                        "upper_note": "E"
                    },
                    "standard_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.QUESTION_TYPE_MISMATCH.value,
                    "needs_manual_review": True
                }
            },
            {
                "name": "题型映射错-用和弦题格式回答调号题",
                "request": {
                    "student_id": "S005",
                    "question_id": "Q_KEY_005",
                    "question_type": QuestionType.KEY_SIGNATURE.value,
                    "student_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major"
                    },
                    "standard_answer": {
                        "tonic": "C",
                        "mode": "major",
                        "sharps": 0,
                        "flats": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.QUESTION_TYPE_MISMATCH.value,
                    "needs_manual_review": True
                }
            }
        ]
    },
    "needs_manual_supplement": {
        "description": "需要人工补资料的记录：业务规则不明确、标准答案有争议等场景",
        "cases": [
            {
                "name": "标准答案调号配置与乐理规则不符",
                "request": {
                    "student_id": "S006",
                    "question_id": "Q_KEY_006",
                    "question_type": QuestionType.KEY_SIGNATURE.value,
                    "student_answer": {
                        "tonic": "C",
                        "mode": "major",
                        "sharps": 0,
                        "flats": 0
                    },
                    "standard_answer": {
                        "tonic": "C",
                        "mode": "major",
                        "sharps": 2,
                        "flats": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "needs_manual_review": True,
                    "review_reason_contains": "调号配置与乐理规则不符"
                }
            },
            {
                "name": "学生答案格式不完整-音程题缺upper_note",
                "request": {
                    "student_id": "S007",
                    "question_id": "Q_INT_007",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "C"
                    },
                    "standard_answer": {
                        "lower_note": "C",
                        "upper_note": "G"
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 0.0,
                    "needs_manual_review": False,
                    "has_format_error": True
                }
            },
            {
                "name": "和弦题音高正确但顺序不同",
                "request": {
                    "student_id": "S008",
                    "question_id": "Q_CHORD_008",
                    "question_type": QuestionType.CHORD.value,
                    "student_answer": {
                        "notes": ["G", "C", "E"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "standard_answer": {
                        "notes": ["C", "E", "G"],
                        "chord_type": "major",
                        "inversion": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "is_correct": False,
                    "score_range": [5.0, 8.0],
                    "note": "根音位置判断错误，需确认是否要求严格按低音位置书写"
                }
            },
            {
                "name": "包含罕见变音记号-重升重降",
                "request": {
                    "student_id": "S009",
                    "question_id": "Q_INT_009",
                    "question_type": QuestionType.INTERVAL.value,
                    "student_answer": {
                        "lower_note": "C##",
                        "upper_note": "Ebb"
                    },
                    "standard_answer": {
                        "lower_note": "D",
                        "upper_note": "D"
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "has_risk": True,
                    "risk_type": RiskType.ENHARMONIC_MISJUDGE.value,
                    "needs_manual_review": True,
                    "note": "重升重降的等音判断需业务确认规则"
                }
            },
            {
                "name": "调号题同时有升号和降号",
                "request": {
                    "student_id": "S010",
                    "question_id": "Q_KEY_010",
                    "question_type": QuestionType.KEY_SIGNATURE.value,
                    "student_answer": {
                        "tonic": "C",
                        "mode": "major",
                        "sharps": 1,
                        "flats": 1
                    },
                    "standard_answer": {
                        "tonic": "C",
                        "mode": "major",
                        "sharps": 0,
                        "flats": 0
                    },
                    "full_score": 10.0
                },
                "expected": {
                    "score": 0.0,
                    "has_format_error": True,
                    "note": "调号中升号降号不能同时存在，格式验证失败"
                }
            }
        ]
    }
}


def print_case_header(category_name: str, description: str):
    print("\n" + "=" * 80)
    print(f"【{category_name}】")
    print(f"说明：{description}")
    print("=" * 80)


def print_case_result(case_name: str, result: dict, expected: dict, passed: bool):
    status = "✅ 通过" if passed else "❌ 待确认"
    print(f"\n{status} {case_name}")
    print(f"  得分：{result.get('score', 'N/A')} / {result.get('full_score', 'N/A')}")
    print(f"  完全正确：{result.get('is_correct', 'N/A')}")
    print(f"  需人工复核：{result.get('needs_manual_review', 'N/A')}")
    if result.get('needs_manual_review'):
        print(f"  复核原因：{result.get('review_reason', 'N/A')}")
    if result.get('risk_flags'):
        for risk in result['risk_flags']:
            print(f"  ⚠️  风险类型：{risk['risk_type']} ({risk['severity']})")
            print(f"     风险说明：{risk['description'][:60]}...")
            print(f"     处理建议：{risk['suggestion'][:60]}...")
    if result.get('partial_scores'):
        print(f"  分步得分（共{len(result['partial_scores'])}项）：")
        for ps in result['partial_scores']:
            print(f"    - {ps['dimension']}: {ps['actual_score']}/{ps['max_score']}")
            print(f"      说明：{ps['explanation']}")
    if result.get('error_explanations'):
        print(f"  错因解释（共{len(result['error_explanations'])}项）：")
        for ee in result['error_explanations']:
            pos = f" [{ee['position']}]" if ee['position'] else ""
            print(f"    - {ee['error_type']}{pos}: {ee['explanation']}")
            if ee['student_value'] is not None:
                print(f"      学生答案：{ee['student_value']}，标准答案：{ee['standard_value']}")
    if 'note' in expected:
        print(f"  📝 业务备注：{expected['note']}")


def run_all_tests():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    total_passed = 0
    total_cases = 0

    for category_key, category_data in TEST_CASES.items():
        print_case_header(category_key, category_data["description"])

        for case in category_data["cases"]:
            total_cases += 1
            response = client.post("/grade", json=case["request"])

            if response.status_code == 201:
                result = response.json()
                expected = case["expected"]

                passed = True

                if "score" in expected:
                    if abs(result["score"] - expected["score"]) > 0.01:
                        passed = False

                if "score_range" in expected:
                    min_s, max_s = expected["score_range"]
                    if not (min_s - 0.01 <= result["score"] <= max_s + 0.01):
                        passed = False

                if "is_correct" in expected:
                    if result["is_correct"] != expected["is_correct"]:
                        passed = False

                if "needs_manual_review" in expected:
                    if result["needs_manual_review"] != expected["needs_manual_review"]:
                        passed = False

                if "has_risk" in expected and expected["has_risk"]:
                    risk_types = [r["risk_type"] for r in result.get("risk_flags", [])]
                    if "risk_type" in expected and expected["risk_type"] not in risk_types:
                        passed = False

                if "partial_score_count" in expected:
                    if len(result.get("partial_scores", [])) != expected["partial_score_count"]:
                        passed = False

                if "error_count" in expected:
                    if len(result.get("error_explanations", [])) != expected["error_count"]:
                        passed = False

                if "review_reason_contains" in expected:
                    if expected["review_reason_contains"] not in (result.get("review_reason") or ""):
                        passed = False

                if "has_format_error" in expected:
                    has_format = any(
                        e["error_type"] == "format_error"
                        for e in result.get("error_explanations", [])
                    )
                    if has_format != expected["has_format_error"]:
                        passed = False

                if passed:
                    total_passed += 1

                print_case_result(case["name"], result, expected, passed)
            else:
                print(f"\n❌ {case['name']} - 请求失败: {response.status_code}")
                print(f"  错误：{response.json()}")

    print("\n" + "=" * 80)
    print(f"测试总结：{total_passed}/{total_cases} 项通过")
    print("=" * 80)
    print("\n📌 关键设计说明：")
    print("\n1. 三类风险独立标记：")
    print("   - ENHARMONIC_MISJUDGE（等音误判）：音高相同记法不同，需业务确认判分规则")
    print("   - PARTIAL_SCORE_MISS（部分得分漏算）：答案缺少得分维度，可能漏判")
    print("   - QUESTION_TYPE_MISMATCH（题型映射错）：答案格式与题型不匹配")
    print("\n2. 分步得分解释：每个得分维度都附带业务易懂的解释，便于调整规则")
    print("\n3. 错因解释：明确标注错误类型、位置、学生/标准答案对比")
    print("\n4. 持久化：所有答题记录和判分结果存入SQLite，支持追溯")
    print("\n5. 状态流转：SUCCESS/NEEDS_REVIEW/FAILED 三态，异常不影响主流程")
    print("=" * 80)


if __name__ == "__main__":
    run_all_tests()
