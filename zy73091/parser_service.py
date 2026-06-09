import re
from models import now_str

MATERIAL_PATTERNS = [
    r'(?:[\u4e00-\u9fa5A-Za-z0-9]+?)(?:管材|电缆|桥架|风管|水管|阀门|法兰|母线|线槽|保温材料)',
]

REVIEW_KEYWORDS = ['送审', '报审', '图纸标注', '设计要求', '设计口径', '图注', '蓝图', '设计说明', '蓝图标注']
CONSTRUCT_KEYWORDS = ['施工', '现场', '实际采用', '班组', '施工单位', '采购', '到货', '进场', '安装', '实际进场', '现场采购']

SPEC_PATTERN = re.compile(
    r'(?:'
    r'(?:DN|dn|Φ|φ|外径|内径|壁厚|规格|型号|截面|千伏|KV|kV|mm)\s*[:：]?\s*'
    r'((?:DN|dn|Φ|φ)?[A-Za-z0-9\u03a6\u03c6×*\-./]{2,30})'
    r'|'
    r'((?<!\d)(?:\d{2,5}[×x*]\d{2,5}(?:[×x*]\d{1,5})?)(?!\d))'
    r')'
)

def _clean_spec(val):
    if not val:
        return None
    s = str(val).strip().strip('×*-.')
    # 过滤纯序号：1. 2. 3. 等
    if re.match(r'^\d+[.、）)]$', s):
        return None
    # 过滤太短的纯数字（如"1"、"2"），但保留 DN100、800×200、Φ108 这种有意义的
    if re.match(r'^\d{1,2}$', s):
        return None
    if len(s) < 2:
        return None
    return s

def _find_material_name(sentence):
    """从单句中找出最后一个出现的材料名词，避免冗余前缀"""
    candidates = []
    core_pat = re.compile(
        r'[\u4e00-\u9fa5A-Za-z0-9]{1,12}?'
        r'(?:管材|电缆|桥架|风管|水管|阀门|法兰|母线|线槽|保温材料)'
    )
    for m in core_pat.finditer(sentence):
        name = m.group(0)
        # 去掉纯修饰前缀：施工单位实际进场桥架 → 桥架；...但消防水管→保留消防水管
        # 策略：如果含"单位/实际/进场/采购/班组"这类施工修饰，只取最后2~4字的核心名词
        cleaned = re.sub(r'^.*?(施工|实际|进场|采购|班组|单位|标注|要求|说明)', '', name)
        if not cleaned:
            cleaned = name[-4:]
        # 如果清理后太短，恢复原名中的一段核心
        if len(cleaned) < 2:
            cleaned = name
        # 再清理一遍：只保留最后一段"XX材料"，例如"消防水管"不动，"XX进场桥架"→"桥架"
        suffixes = ['管材','电缆','桥架','风管','水管','阀门','法兰','母线','线槽','保温材料']
        final = cleaned
        for suf in suffixes:
            if cleaned.endswith(suf) and len(cleaned) > len(suf) + 1:
                prefix = cleaned[:-len(suf)]
                if any(bad in prefix for bad in ['施工','实际','进场','采购','班组','单位','标注','要求','说明','设计','现场','送审']):
                    final = suf
                    break
        candidates.append(final)
    if not candidates:
        return None
    # 选在句中最后出现、且含足够语义的那个；去重
    uniq = []
    for c in candidates:
        if c not in uniq:
            uniq.append(c)
    # 优先选非纯后缀的（带修饰的）如"消防水管"比"水管"好
    for c in uniq:
        if any(c.endswith(s) and len(c)>len(s) for s in suffixes):
            return c
    return uniq[-1]

COORD_PATTERNS = [
    re.compile(r'([\u4e00-\u9fa5A-Za-z]+(?:系统|管线|桥架|风管))[^\d]{0,10}'
               r'(?:坐标|原点|基点|定位)[^\d]{0,10}'
               r'X\s*[:：]?\s*([\-+]?\d+\.?\d*)[^\d]{0,6}'
               r'Y\s*[:：]?\s*([\-+]?\d+\.?\d*)[^\d]{0,6}'
               r'Z\s*[:：]?\s*([\-+]?\d+\.?\d*)'),
]

REFERENCE_POINT = (0.0, 0.0, 0.0)
OFFSET_THRESHOLD = 50.0


def _split_by_keywords(text, keywords):
    """找出关键词所在位置的上下文片段"""
    snippets = []
    for kw in keywords:
        for m in re.finditer(kw, text):
            start = max(0, m.start() - 30)
            end = min(len(text), m.end() + 60)
            snippets.append((m.start(), text[start:end]))
    snippets.sort(key=lambda x: x[0])
    return [s[1] for s in snippets]


def _iter_spec_matches(snippet):
    for m in SPEC_PATTERN.finditer(snippet):
        val = m.group(1) or m.group(2)
        sp = _clean_spec(val)
        if sp:
            yield sp

def _extract_spec(snippet):
    specs = list(_iter_spec_matches(snippet))
    return ' / '.join(specs) if specs else None

def _extract_first_spec(snippet):
    for sp in _iter_spec_matches(snippet):
        return sp
    return None

def _extract_two_specs(snippet):
    """同一句出现两个规格时按顺序取，用于「送审A，施工B」"""
    out = []
    for sp in _iter_spec_matches(snippet):
        if sp and sp not in out:
            out.append(sp)
            if len(out) >= 2:
                break
    return out


def _split_sentences(text):
    """按换行/句号/分号/逗号切句，避免上下文跨行串扰"""
    parts = re.split(r'[\n\r。；;！!？?]+', text or '')
    return [p.strip() for p in parts if p.strip()]

def parse_meeting_minutes(text, supplementary='', oral=''):
    """从会议纪要+后补备注+口头说明中提取材料和口径对比（逐句分析，防串扰）"""
    all_text = '\n'.join(filter(None, [text, supplementary, oral]))
    if not all_text.strip():
        return {
            'materials': [],
            'detected_mismatch_count': 0,
            'note': '未检测到材料信息，请核对输入内容。'
        }

    material_specs = {}
    suffixes = ['管材','电缆','桥架','风管','水管','阀门','法兰','母线','线槽','保温材料']
    sentences = _split_sentences(all_text)

    for sent in sentences:
        name = _find_material_name(sent)
        if not name:
            continue
        material_specs.setdefault(name, {'review': None, 'construct': None, 'modified': False})

        # 判断该句语境
        has_review = any(kw in sent for kw in REVIEW_KEYWORDS)
        has_construct = any(kw in sent for kw in CONSTRUCT_KEYWORDS)

        specs = _extract_two_specs(sent)
        first = specs[0] if len(specs) >= 1 else _extract_first_spec(sent)
        second = specs[1] if len(specs) >= 2 else None

        def store_review(val):
            if not val: return
            cur = material_specs[name]['review']
            if cur is None:
                material_specs[name]['review'] = val
            elif cur != val:
                material_specs[name]['modified'] = True
                material_specs[name]['review'] = val

        def store_construct(val):
            if not val: return
            cur = material_specs[name]['construct']
            if cur is None:
                material_specs[name]['construct'] = val
            elif cur != val:
                material_specs[name]['modified'] = True
                material_specs[name]['construct'] = val

        if has_review and not has_construct:
            store_review(first)
        elif has_construct and not has_review:
            store_construct(first)
        elif has_review and has_construct:
            # 两个语境都在同一句：按关键词出现先后决定两个规格归属
            r_pos = min([sent.find(kw) for kw in REVIEW_KEYWORDS if kw in sent] + [9999])
            c_pos = min([sent.find(kw) for kw in CONSTRUCT_KEYWORDS if kw in sent] + [9999])
            if r_pos < c_pos:
                store_review(first)
                store_construct(second)
            else:
                store_construct(first)
                store_review(second)
        else:
            # 无语境关键词但有材料+规格：先填送审空位，再填施工空位
            if first:
                if material_specs[name]['review'] is None:
                    store_review(first)
                elif material_specs[name]['construct'] is None:
                    store_construct(first)
                elif first != material_specs[name]['review'] and first != material_specs[name]['construct']:
                    store_construct(first)

    materials = []
    mismatch_count = 0
    for name, info in material_specs.items():
        mismatch = 0
        if info['review'] and info['construct'] and info['review'] != info['construct']:
            mismatch = 1
            mismatch_count += 1
        materials.append({
            'material_name': name,
            'review_spec': info['review'],
            'construction_spec': info['construct'],
            'spec_mismatch': mismatch,
            'modified_after_submit': 1 if info['modified'] else 0,
            'submitted_at': now_str(),
            'modified_at': now_str() if info['modified'] else None,
            'version_tag': 2 if info['modified'] else 1,
        })

    note = ''
    if mismatch_count > 0:
        note = f'检测到 {mismatch_count} 项材料送审口径与施工口径不一致，请复核。'
    elif not materials:
        note = '未从文本中解析出标准材料条目，建议手工补充。'
    else:
        note = '材料口径解析完成，暂未发现不一致。'

    return {
        'materials': materials,
        'detected_mismatch_count': mismatch_count,
        'note': note,
    }


def detect_coordinate_offsets(text, supplementary='', oral=''):
    """检测模型坐标偏移，任一维度超过阈值即判定为偏移"""
    all_text = '\n'.join(filter(None, [text, supplementary, oral]))
    checks = []
    any_offset = False

    for pattern in COORD_PATTERNS:
        for m in pattern.finditer(all_text):
            sys_name = m.group(1)
            try:
                x = float(m.group(2))
                y = float(m.group(3))
                z = float(m.group(4))
            except (ValueError, TypeError):
                continue
            ox = x - REFERENCE_POINT[0]
            oy = y - REFERENCE_POINT[1]
            oz = z - REFERENCE_POINT[2]
            offset = abs(ox) > OFFSET_THRESHOLD or abs(oy) > OFFSET_THRESHOLD or abs(oz) > OFFSET_THRESHOLD
            if offset:
                any_offset = True
            checks.append({
                'system_name': sys_name,
                'origin_x': x,
                'origin_y': y,
                'origin_z': z,
                'offset_detected': 1 if offset else 0,
                'offset_value_x': ox,
                'offset_value_y': oy,
                'offset_value_z': oz,
                'confirmed': 0,
            })

    return {
        'checks': checks,
        'any_offset': any_offset,
        'threshold': OFFSET_THRESHOLD,
    }


def extract_collisions(text, supplementary='', oral=''):
    """提取碰撞点信息（简化版）"""
    all_text = '\n'.join(filter(None, [text, supplementary, oral]))
    collisions = []
    levels = {'严重': '严重', '中等': '中等', '轻微': '轻微', '一般': '轻微', '重': '严重'}

    collision_pat = re.compile(
        r'([\u4e00-\u9fa5A-Za-z0-9]+(?:系统|管线|桥架|风管|水管))'
        r'[^\u4e00-\u9fa5A-Za-z0-9]{0,8}'
        r'与'
        r'[^\u4e00-\u9fa5A-Za-z0-9]{0,8}'
        r'([\u4e00-\u9fa5A-Za-z0-9]+(?:系统|管线|桥架|风管|水管))'
    )
    level_pat = re.compile(r'(严重|中等|轻微|一般|重)碰撞')
    loc_pat = re.compile(r'位置[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9\-#]+(?:层|区|段|轴))')

    level = '中等'
    lm = level_pat.search(all_text)
    if lm:
        level = levels.get(lm.group(1), '中等')

    location = None
    lom = loc_pat.search(all_text)
    if lom:
        location = lom.group(1)

    for m in collision_pat.finditer(all_text):
        collisions.append({
            'system_a': m.group(1),
            'system_b': m.group(2),
            'collision_level': level,
            'location': location,
            'resolved': 0,
            'version_tag': 1,
        })
    return collisions


def synthesize_judgement(mismatch_count, has_offset, offset_confirmed, collision_count):
    """综合判定：有偏移未确认则挂起，否则按问题数量判定"""
    if has_offset and not offset_confirmed:
        return 'suspended', '模型坐标存在偏移且未确认，预审挂起，请复核人确认坐标后再行判定。'
    issues = mismatch_count + collision_count
    if issues == 0:
        return 'pass', '材料口径一致、坐标无异常、无碰撞点，预审通过。'
    if mismatch_count > 0:
        return 'reject', f'检测到 {mismatch_count} 项材料送审/施工口径不一致，不予通过。'
    return 'conditional', f'检测到 {collision_count} 处碰撞点，附条件通过，需整改后复审。'
