from database import get_conn, init_db
from datetime import datetime, timedelta
import json


def seed_data():
    init_db()
    conn = get_conn()
    c = conn.cursor()

    now = datetime.now()

    c.execute('''INSERT INTO model_versions 
        (version_name, model_hash, threshold, threshold_note, created_at, created_by, config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (
        'v2.3.0-20260520',
        'a1b2c3d4e5f6',
        0.75,
        '2026.05.20调整：阈值从0.70提至0.75，减少误判率，参考Q2运营反馈#case-204',
        (now - timedelta(days=12)).isoformat(),
        '算法组-小李',
        json.dumps({'backbone': 'ViT-L/14', 'augment': 'True', 'dataset': 'copyright-v3'})
    ))
    model_v230_id = c.lastrowid

    c.execute('''INSERT INTO model_versions 
        (version_name, model_hash, threshold, threshold_note, created_at, created_by, config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (
        'v2.2.1-20260410',
        'f6e5d4c3b2a1',
        0.70,
        '2026.04.10基线版本，配合旧口径标注使用',
        (now - timedelta(days=45)).isoformat(),
        '算法组-小李',
        json.dumps({'backbone': 'ViT-L/14', 'augment': 'False', 'dataset': 'copyright-v2'})
    ))
    model_v221_id = c.lastrowid

    samples = [
        ('SAMPLE-001', 'https://img.example.com/001.png',
         '一只戴着蓝色墨镜的柯基本身就是一道风景，背景是城市街道，胶片质感',
         '运营提交-20260601', now.isoformat(), 'BATCH-20260602-001', 'ai_generated,animal'),
        ('SAMPLE-002', 'https://img.example.com/002.png',
         '宫崎骏风格的天空之城，飞艇在云层中穿梭，温暖的黄昏光线',
         '运营提交-20260601', now.isoformat(), 'BATCH-20260602-001', 'ai_generated,style_copy'),
        ('SAMPLE-003', 'https://img.example.com/003.png',
         '像素风格的马里奥跳跃吃金币，8bit复古游戏画面',
         '历史标注迁移', (now - timedelta(days=60)).isoformat(), 'BATCH-20260602-001', 'game_character,old_caliber'),
        ('SAMPLE-004', 'https://img.example.com/004.png',
         '迪士尼风格的冰雪女王艾莎站在冰雪城堡前',
         '运营提交-20260601', now.isoformat(), 'BATCH-20260602-001', 'character_infringement'),
        ('SAMPLE-005', 'https://img.example.com/005.png',
         '手绘风格山水画，远山近水，孤舟蓑笠翁，留白意境',
         '运营提交-20260601', now.isoformat(), 'BATCH-20260602-001', 'art_style,data_leak'),
    ]

    for s in samples:
        c.execute('''INSERT OR IGNORE INTO samples 
            (sample_id, image_url, prompt, source, created_at, batch_id, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)''', s)

    annotations = [
        ('SAMPLE-003', 1, '游戏角色侵权', '标注组-老王',
         (now - timedelta(days=55)).isoformat(),
         '2026.04旧口径：包含知名游戏角色特征即判定侵权，不要求商用场景',
         'v1.0-2026Q1'),
        ('SAMPLE-004', 1, '知名动画角色侵权', '标注组-老赵',
         (now - timedelta(days=3)).isoformat(),
         '面部特征、服装、背景高度匹配迪士尼《冰雪奇缘》',
         'v2.0-2026Q2'),
        ('SAMPLE-002', 1, '风格抄袭', '标注组-小孙',
         (now - timedelta(days=2)).isoformat(),
         '宫崎骏风格特征明显，属于重点监控的艺术风格抄袭',
         'v2.0-2026Q2'),
    ]

    for a in annotations:
        c.execute('''INSERT OR IGNORE INTO annotation_table 
            (sample_id, is_copyright, copyright_type, annotator, annotated_at, note, caliber_version)
            VALUES (?, ?, ?, ?, ?, ?, ?)''', a)

    # === 第1次运行：旧模型 v2.2.1（阈值0.70）===
    run1_at = (now - timedelta(hours=6)).isoformat()
    c.execute('''INSERT INTO batch_runs
        (batch_id, model_version_id, run_at, operator, metrics_json, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)''', (
        'BATCH-20260602-001', model_v221_id, run1_at, '风控运营-老唐',
        json.dumps({
            'total': 5, 'processed': 5, 'skipped_protected': 0,
            'positives': 2, 'negatives': 3, 'needs_review': 1,
            'conflicts': 1, 'positive_rate': 0.4
        }), 5
    ))
    run1_id = c.lastrowid

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-001', model_v221_id, 'BATCH-20260602-001', run1_id,
        0.08, 0,
        json.dumps([
            {'type': 'image_similarity', 'top1_match': '公开数据集_12345', 'similarity': 0.05},
            {'type': 'text_matching', 'prompt_match': 'no_copyright_keyword', 'score': 0.03}
        ]),
        '画面元素为原创柴犬形象，未匹配到版权作品特征；提示词无版权关键词',
        run1_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-002', model_v221_id, 'BATCH-20260602-001', run1_id,
        0.73, 1,
        json.dumps([
            {'type': 'style_classification', 'top_style': '宫崎骏', 'confidence': 0.88},
            {'type': 'image_similarity', 'top1_match': '天空之城_剧照_089', 'similarity': 0.62}
        ]),
        '风格分类匹配宫崎骏（0.88），与《天空之城》剧照相似度0.62；旧模型阈值0.70，0.73≥0.70判为侵权',
        run1_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-003', model_v221_id, 'BATCH-20260602-001', run1_id,
        0.92, 1,
        json.dumps([
            {'type': 'character_detection', 'detected': 'mario', 'confidence': 0.96},
            {'type': 'image_similarity', 'top1_match': '超级马里奥_官方素材_456', 'similarity': 0.88}
        ]),
        '检测到任天堂知名游戏角色马里奥（置信度0.96），与官方素材相似度0.88；旧口径v1.0判定侵权',
        run1_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-004', model_v221_id, 'BATCH-20260602-001', run1_id,
        0.97, 1,
        json.dumps([
            {'type': 'character_detection', 'detected': 'elsa', 'confidence': 0.99},
            {'type': 'image_similarity', 'top1_match': '冰雪奇缘_海报_123', 'similarity': 0.93}
        ]),
        '检测到迪士尼《冰雪奇缘》主角艾莎，面部相似度0.94，高置信度角色侵权',
        run1_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-005', model_v221_id, 'BATCH-20260602-001', run1_id,
        0.02, 0,
        json.dumps([
            {'type': 'image_similarity', 'top1_match': 'TRAINSET_art_009872', 'similarity': 0.98},
            {'type': 'train_set_check', 'in_train': True, 'train_id': 'art_009872', 'note': '样本泄漏警告'}
        ]),
        '该样本与训练集TRAINSET_art_009872相似度达0.98，疑似训练样本泄漏；此样本评测结果不可信',
        run1_at
    ))
    eval_005_run1_id = c.lastrowid

    c.execute('''INSERT INTO label_conflicts
        (sample_id, evaluation_log_id, conflict_type, description, model_result, annotation_result, detected_at, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-005', eval_005_run1_id, 'sample_leakage',
        '检测到训练样本泄漏，与训练集TRAINSET_art_009872相似度0.98，该样本评测指标作废',
        0, None, run1_at, 0
    ))

    # === 第2次运行：新模型 v2.3.0（阈值0.75）===
    run2_at = (now - timedelta(hours=2)).isoformat()
    c.execute('''INSERT INTO batch_runs
        (batch_id, model_version_id, run_at, operator, metrics_json, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)''', (
        'BATCH-20260602-001', model_v230_id, run2_at, '风控运营-老唐',
        json.dumps({
            'total': 5, 'processed': 4, 'skipped_protected': 1,
            'positives': 2, 'negatives': 2, 'needs_review': 1,
            'conflicts': 2, 'positive_rate': 0.5
        }), 5
    ))
    run2_id = c.lastrowid

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-001', model_v230_id, 'BATCH-20260602-001', run2_id,
        0.12, 0,
        json.dumps([
            {'type': 'image_similarity', 'top1_match': '公开数据集_12345', 'similarity': 0.08},
            {'type': 'text_matching', 'prompt_match': 'no_copyright_keyword', 'score': 0.05},
            {'type': 'character_detection', 'detected': 'dog', 'breed': 'corgi', 'confidence': 0.98}
        ]),
        '画面元素为原创柴犬形象，未匹配到版权作品特征；提示词无版权关键词；风格为通用摄影风格',
        run2_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-002', model_v230_id, 'BATCH-20260602-001', run2_id,
        0.72, 0,
        json.dumps([
            {'type': 'style_classification', 'top_style': '宫崎骏', 'confidence': 0.88},
            {'type': 'image_similarity', 'top1_match': '天空之城_剧照_089', 'similarity': 0.62},
            {'type': 'composition_match', 'match_score': 0.70, 'note': '飞艇+云层+黄昏构图匹配'}
        ]),
        '风格分类高度匹配宫崎骏（0.88），与《天空之城》剧照相似度0.62略低于侵权阈值0.65；提示词明确提及"宫崎骏风格"；建议人工复核风格侵权判定标准',
        run2_at
    ))
    eval_002_id = c.lastrowid

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-003', model_v230_id, 'BATCH-20260602-001', run2_id,
        0.92, 1,
        json.dumps([
            {'type': 'character_detection', 'detected': 'mario', 'confidence': 0.96},
            {'type': 'image_similarity', 'top1_match': '超级马里奥_官方素材_456', 'similarity': 0.88},
            {'type': 'style_classification', 'top_style': '8bit_pixel', 'confidence': 0.94}
        ]),
        '检测到任天堂知名游戏角色马里奥（置信度0.96），与官方素材相似度0.88；根据旧口径v1.0，包含知名游戏角色特征即判定侵权',
        run2_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-004', model_v230_id, 'BATCH-20260602-001', run2_id,
        0.96, 1,
        json.dumps([
            {'type': 'character_detection', 'detected': 'elsa', 'confidence': 0.99},
            {'type': 'face_recognition', 'match': '冰雪女王艾莎', 'similarity': 0.94},
            {'type': 'image_similarity', 'top1_match': '冰雪奇缘_海报_123', 'similarity': 0.91}
        ]),
        '检测到迪士尼《冰雪奇缘》主角艾莎，面部相似度0.94，服装、场景高度匹配官方海报；属于高置信度角色侵权',
        run2_at
    ))

    c.execute('''INSERT INTO evaluation_logs
        (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result, evidence_json, reasons, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-005', model_v230_id, 'BATCH-20260602-001', run2_id,
        0.03, 0,
        json.dumps([
            {'type': 'image_similarity', 'top1_match': 'TRAINSET_art_009872', 'similarity': 0.98},
            {'type': 'train_set_check', 'in_train': True, 'train_id': 'art_009872', 'note': '样本泄漏警告'}
        ]),
        '该样本与训练集TRAINSET_art_009872相似度达0.98，疑似训练样本泄漏；请核查样本来源，此样本评测结果不可信',
        run2_at
    ))
    eval_005_run2_id = c.lastrowid

    # SAMPLE-002 人工改判（新模型判0，但老唐判为侵权，受保护）
    c.execute('''INSERT INTO manual_reviews
        (sample_id, evaluation_log_id, final_result, reviewer, reviewed_at, review_note, override_protected)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-002', eval_002_id, 1, '风控运营-老唐',
        (now - timedelta(hours=1)).isoformat(),
        '虽然模型分数0.72低于阈值0.75，但宫崎骏风格属于重点监控的艺术风格抄袭范畴，根据运营规则第12条，应判定为侵权。此判罚受保护，新模型结果不得覆盖。',
        1
    ))

    # SAMPLE-002 标签冲突（模型0 vs 标注1，已由人工解决）
    c.execute('''INSERT INTO label_conflicts
        (sample_id, evaluation_log_id, conflict_type, description, model_result, annotation_result, detected_at, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-002', eval_002_id, 'model_vs_annotation',
        '模型预测结果(0.72，非侵权)与人工标注(侵权)不一致，建议重点复核风格侵权判定边界',
        0, 1, (now - timedelta(hours=1, minutes=50)).isoformat(), 1
    ))

    # SAMPLE-005 样本泄漏（第2次运行也检测到）
    c.execute('''INSERT INTO label_conflicts
        (sample_id, evaluation_log_id, conflict_type, description, model_result, annotation_result, detected_at, resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
        'SAMPLE-005', eval_005_run2_id, 'sample_leakage',
        '检测到训练样本泄漏，与训练集TRAINSET_art_009872相似度0.98，该样本评测指标作废',
        0, None, (now - timedelta(hours=1, minutes=50)).isoformat(), 0
    ))

    conn.commit()
    conn.close()
    print("样例数据初始化完成！")
    print(f"  运行1: id={run1_id}, 模型v2.2.1(阈值0.70), 时间={run1_at}")
    print(f"  运行2: id={run2_id}, 模型v2.3.0(阈值0.75), 时间={run2_at}")
    print("  关键差异: SAMPLE-002 第1次运行模型判侵权(0.73≥0.70), 第2次运行模型判非侵权(0.72<0.75)")
    print("  SAMPLE-002 已人工改判为侵权并受保护, /compare 页面可对比两次运行")


if __name__ == '__main__':
    seed_data()
