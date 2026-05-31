import re
from datetime import datetime
from database import get_db, generate_id
from core_logic import log_audit

TANGENT_KEYWORDS = [
    '切线', '导数', '斜率', '切点', '瞬时变化率',
    'f\'(x)', "f'(x)", 'dy/dx', 'y - y0', '点斜式'
]

TANGENT_ERROR_PATTERNS = [
    {
        'name': '切点验证缺失',
        'pattern': r'(切线|导数|斜率).{0,20}(方程|直线|求解)',
        'check': lambda text, c: not re.search(r'(验证|确认|检查|代入).{0,20}(切点|点)', text),
        'severity': 'high',
        'reason_template': '检查到切线求解过程，但未发现对切点的验证步骤。',
        'next_step_template': '请补充验证：确认所求切点(x0, f(x0))确实在原函数曲线上，即验证f(x0) = y0。'
    },
    {
        'name': '导数计算未标注',
        'pattern': r'(切线|斜率).{0,30}(方程|=)',
        'check': lambda text, c: not re.search(r'(f\'|f\'\(x\)|导数|dy/dx).{0,10}(=|\')', text),
        'severity': 'medium',
        'reason_template': '切线方程已写出，但未明确标注导数计算过程。',
        'next_step_template': '请补充导数计算步骤：先求f\'(x)，再代入x0得到切线斜率k = f\'(x0)。'
    },
    {
        'name': '点斜式不完整',
        'pattern': r'(切线|方程).{0,20}(y|Y).{0,5}(-|=)',
        'check': lambda text, c: not re.search(r'y\s*-\s*y0\s*=\s*k\s*\(\s*x\s*-\s*x0\s*\)|y\s*-\s*f\s*\(\s*x0\s*\)\s*=\s*f\'\s*\(\s*x0\s*\)\s*\(\s*x\s*-\s*x0\s*\)', text),
        'severity': 'medium',
        'reason_template': '切线方程书写格式不规范，未使用标准点斜式。',
        'next_step_template': '请使用标准点斜式书写：y - f(x0) = f\'(x0)(x - x0)，明确标出切点和斜率。'
    },
    {
        'name': '定义域边界未考虑',
        'pattern': r'(切线|导数).{0,50}(x\s*=\s*0|x=0|边界|端点)',
        'check': lambda text, c: not re.search(r'(定义域|定义区间|存在|连续|可导).{0,20}(x0|切点|x\s*=)', text),
        'severity': 'high',
        'reason_template': '涉及边界点或特殊点x=0的切线问题，但未讨论函数在该点的可导性。',
        'next_step_template': '请补充分析：1）函数在x0处是否连续；2）左右导数是否存在且相等，确认可导性后再求切线。'
    },
    {
        'name': '垂直切线未识别',
        'pattern': r'(导数|斜率).{0,20}(不存在|无穷|∞)',
        'check': lambda text, c: not re.search(r'(垂直切线|x\s*=\s*|竖直|无穷大).{0,10}(切线|方程)', text),
        'severity': 'high',
        'reason_template': '导数不存在（无穷大），但未识别出这是垂直切线的情况。',
        'next_step_template': '当f\'(x0) → ∞时，切线为垂直于x轴的直线x = x0，请明确写出切线方程x = x0。'
    },
    {
        'name': '多切线情况遗漏',
        'pattern': r'(过点|从点|经过).{0,20}(切线|作切线)',
        'check': lambda text, c: not re.search(r'(两|2|二|多条|若干).{0,10}(切线|解)', text) and c.get('is_external_point', False),
        'severity': 'high',
        'reason_template': '从曲线外一点作切线，可能存在多条切线，但只求出了一条。',
        'next_step_template': '请设切点为(x0, f(x0))，解方程：[f(x0) - y_p]/(x0 - x_p) = f\'(x0)，这是关于x0的方程，可能有多个解。'
    },
    {
        'name': '单位或量纲错误',
        'pattern': r'(米|秒|速度|速率|km|m/s).{0,30}(切线|导数)',
        'check': lambda text, c: not re.search(r'(单位|量纲|/|每).{0,10}(物理|实际|意义)', text),
        'severity': 'low',
        'reason_template': '涉及物理应用的导数问题，但未说明导数的物理意义和单位。',
        'next_step_template': '请说明导数的实际意义：如速度v(t) = s\'(t)，单位为m/s；并检查计算结果的量纲是否正确。'
    }
]

DIFFICULTY_RULES = [
    {
        'tag': '基础',
        'indicators': ['y = x²', 'y = 2x + 1', '点(1,1)', 'x=1处', '一元二次'],
        'reason': '题目涉及基本初等函数，在明确给出的切点处求切线，属于基础题型。'
    },
    {
        'tag': '中等',
        'indicators': ['y = x³', 'y = ln x', 'y = e^x', '复合函数', '两个点'],
        'reason': '题目涉及指数、对数或简单复合函数，需要熟练求导公式。'
    },
    {
        'tag': '较难',
        'indicators': ['参数方程', '隐函数', '过点', '最值', '范围'],
        'reason': '题目涉及隐函数求导或从外部点作切线，需要解方程讨论。'
    },
    {
        'tag': '难题',
        'indicators': ['分段函数', '绝对值', '讨论', '证明', '存在性'],
        'reason': '题目涉及分段函数可导性讨论或证明题，需要左右导数分析。'
    },
    {
        'tag': '竞赛级',
        'indicators': ['n阶导数', '泰勒展开', '莱布尼茨', '极限定义', '竞赛'],
        'reason': '题目涉及高阶导数或需用导数定义严格证明，属于竞赛难度。'
    }
]

def analyze_text(text):
    text_lower = text.lower()
    
    has_tangent_content = any(kw in text for kw in TANGENT_KEYWORDS)
    
    analysis = {
        'is_tangent_problem': has_tangent_content,
        'keyword_matches': [kw for kw in TANGENT_KEYWORDS if kw in text],
        'is_external_point': bool(re.search(r'(过点|从点|经过点|不经过|不在曲线上).{0,20}(\(|（)\s*\d', text)),
        'has_boundary': bool(re.search(r'(边界|端点|x\s*=\s*0|x=0|定义域)', text)),
        'has_infinite_derivative': bool(re.search(r'(不存在|无穷|∞|垂直)', text)),
        'has_physics_context': bool(re.search(r'(物理|速度|速率|米|秒|km)', text)),
        'difficulty_indicators': []
    }
    
    for rule in DIFFICULTY_RULES:
        matches = [ind for ind in rule['indicators'] if ind in text]
        if matches:
            analysis['difficulty_indicators'].append({
                'tag': rule['tag'],
                'matches': matches,
                'reason': rule['reason']
            })
    
    return analysis

def check_tangent_lecture(lecture_id, operator='user'):
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT * FROM lectures WHERE id = ?', (lecture_id,))
    lecture = dict(c.fetchone())
    
    c.execute('SELECT content FROM commentary_records WHERE lecture_id = ? ORDER BY created_at',
              (lecture_id,))
    commentaries = [row['content'] for row in c.fetchall()]
    
    full_text = lecture['title'] + '\n' + '\n'.join(commentaries)
    analysis = analyze_text(full_text)
    
    check_id = generate_id('CHK')
    now = datetime.now().isoformat()
    
    errors = []
    if analysis['is_tangent_problem']:
        for pattern in TANGENT_ERROR_PATTERNS:
            if re.search(pattern['pattern'], full_text) and pattern['check'](full_text, analysis):
                errors.append({
                    'name': pattern['name'],
                    'severity': pattern['severity'],
                    'reason': pattern['reason_template'],
                    'next_step': pattern['next_step_template']
                })
    
    if not analysis['is_tangent_problem']:
        result = 'not_applicable'
        confidence = 1.0
        reasoning = '未检测到微积分切线相关内容，本次检查不适用。'
        next_step = '无需处理。如果这确实是切线问题，请在标题或讲评中包含"切线"、"导数"等关键词。'
    elif not errors:
        result = 'passed'
        confidence = 0.9
        reasoning = '通过检查：切线求解过程完整，包含切点验证、导数计算标注、规范的点斜式书写。'
        next_step = '可以用于教学。建议在讲评中强调：1）验证切点在曲线上；2）明确写出点斜式的标准形式。'
    else:
        result = 'failed'
        high_count = sum(1 for e in errors if e['severity'] == 'high')
        confidence = 0.7 + 0.1 * high_count
        
        reasons = []
        next_steps = []
        for i, e in enumerate(errors, 1):
            severity_label = {'high': '【重要】', 'medium': '【注意】', 'low': '【建议】'}[e['severity']]
            reasons.append(f"{i}. {severity_label} {e['name']}：{e['reason']}")
            next_steps.append(f"{i}. {severity_label} {e['next_step']}")
        
        reasoning = '\n'.join(reasons)
        next_step = '\n'.join(next_steps)
    
    if analysis['difficulty_indicators'] and not lecture['difficulty_tag']:
        suggested_diff = analysis['difficulty_indicators'][0]
        reasoning += f'\n\n【难度建议】根据题目特征，建议标记为「{suggested_diff["tag"]}」。理由：{suggested_diff["reason"]}'
        next_step += f'\n\n【下一步】请人工确认难度标签是否为「{suggested_diff["tag"]}」。'
    
    c.execute('''INSERT INTO tangent_checks 
                 (id, lecture_id, checked_at, result, reasoning, next_step, 
                  confidence, checker, manual_confirm)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (check_id, lecture_id, now, result, reasoning, next_step,
               confidence, 'system', 0))
    
    c.execute('''UPDATE lectures SET updated_at = ?, version = version + 1 
                 WHERE id = ?''', (now, lecture_id))
    
    log_audit(conn, 'TANGENT_CHECK', lecture_id=lecture_id,
              record_type='check', record_id=check_id,
              new_value={'result': result, 'confidence': confidence,
                        'error_count': len(errors)},
              operator=operator,
              note=f'微积分切线检查：{result}')
    
    conn.commit()
    conn.close()
    
    return {
        'check_id': check_id,
        'result': result,
        'confidence': confidence,
        'reasoning': reasoning,
        'next_step': next_step,
        'errors': errors,
        'analysis': analysis
    }

def confirm_check_result(check_id, lecture_id, is_approved, comment=None, operator='user'):
    conn = get_db()
    now = datetime.now().isoformat()
    
    c = conn.cursor()
    c.execute('SELECT * FROM tangent_checks WHERE id = ?', (check_id,))
    check = dict(c.fetchone())
    
    c.execute('''UPDATE tangent_checks 
                 SET manual_confirm = ?, confirmed_by = ?, confirmed_at = ?
                 WHERE id = ?''',
              (1 if is_approved else 0, operator, now, check_id))
    
    c.execute('''UPDATE lectures SET updated_at = ?, version = version + 1 
                 WHERE id = ?''', (now, lecture_id))
    
    log_audit(conn, 'CONFIRM_CHECK', lecture_id=lecture_id,
              record_type='check', record_id=check_id,
              old_value={'manual_confirm': check['manual_confirm']},
              new_value={'manual_confirm': 1 if is_approved else 0, 'comment': comment},
              operator=operator,
              note=f"人工确认检查结果：{'通过' if is_approved else '驳回'}")
    
    conn.commit()
    conn.close()
    
    return {'success': True}

def get_check_history(lecture_id):
    conn = get_db()
    c = conn.cursor()
    c.execute('''SELECT * FROM tangent_checks 
                 WHERE lecture_id = ? ORDER BY checked_at DESC''',
              (lecture_id,))
    checks = [dict(row) for row in c.fetchall()]
    conn.close()
    return checks
