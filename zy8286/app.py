from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import re
import json
import yaml
import uuid
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
import jieba
import jieba.analyse

app = Flask(__name__)
CORS(app, supports_credentials=True)

UPLOAD_FOLDER = 'uploads'
DATA_FOLDER = 'data'
OUTPUT_FOLDER = 'output'
SAMPLE_FOLDER = 'samples'

for folder in [UPLOAD_FOLDER, DATA_FOLDER, OUTPUT_FOLDER, SAMPLE_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['DATA_FOLDER'] = DATA_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER

stopwords_path = os.path.join(os.path.dirname(__file__), 'stopwords.txt')
if os.path.exists(stopwords_path):
    jieba.analyse.set_stop_words(stopwords_path)

survey_data = pd.DataFrame()
taxonomy_data = {}
releases_data = []
classification_results = []
cluster_results = []
review_trail = []

DEFAULT_TAXONOMY = {
    'categories': [
        {'id': 'functionality', 'name': '功能体验', 'keywords': ['功能', '操作', '流程', '界面', '显示', '按钮', '菜单', '布局', '设计', '交互']},
        {'id': 'price', 'name': '价格策略', 'keywords': ['价格', '贵', '便宜', '定价', '免费', '付费', '会员', '订阅', '成本', '性价比']},
        {'id': 'performance', 'name': '性能表现', 'keywords': ['速度', '慢', '快', '卡顿', '崩溃', '加载', '响应', '性能', '效率', '稳定']},
        {'id': 'collaboration', 'name': '协作能力', 'keywords': ['团队', '协作', '分享', '权限', '多人', '共享', '同步', '版本', '评论', '沟通']},
        {'id': 'onboarding', 'name': '上手成本', 'keywords': ['上手', '学习', '教程', '帮助', '文档', '新手', '复杂', '简单', '易用', '培训']},
        {'id': 'other', 'name': '其他', 'keywords': []}
    ]
}

def clean_text(text):
    if pd.isna(text) or text is None:
        return ''
    text = str(text)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def extract_keywords(text, top_k=5):
    if not text or len(text) < 2:
        return []
    try:
        keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=False)
        return keywords
    except:
        return list(set([w for w in jieba.lcut(text) if len(w) > 1]))[:top_k]

def classify_response(text, taxonomy):
    if not text or text.strip() == '':
        return {'category': 'empty', 'confidence': 0, 'keywords': [], 'reason': '文本为空'}
    
    text = text.lower()
    categories = taxonomy.get('categories', DEFAULT_TAXONOMY['categories'])
    
    best_category = 'other'
    best_score = 0
    matched_keywords = []
    reason_parts = []
    
    for cat in categories:
        cat_id = cat.get('id', 'other')
        cat_name = cat.get('name', '其他')
        keywords = [k.lower() for k in cat.get('keywords', [])]
        
        if not keywords:
            continue
        
        matches = []
        for kw in keywords:
            if kw in text:
                matches.append(kw)
        
        if matches:
            score = len(matches)
            if score > best_score:
                best_score = score
                best_category = cat_id
                matched_keywords = matches
                reason_parts = [f"匹配关键词: {', '.join(matches)}"]
    
    if best_category == 'other':
        reason = '未匹配到预设分类关键词，归为其他'
    else:
        reason = '；'.join(reason_parts) if reason_parts else '基于关键词匹配'
    
    return {
        'category': best_category,
        'confidence': min(best_score * 0.2, 0.9),
        'keywords': matched_keywords,
        'reason': reason
    }

def cluster_responses(responses_df, n_clusters=None):
    if len(responses_df) == 0:
        return []
    
    valid_responses = responses_df[responses_df['clean_text'].str.strip() != ''].copy()
    empty_responses = responses_df[responses_df['clean_text'].str.strip() == ''].copy()
    
    if len(valid_responses) == 0:
        return []
    
    def tokenize(text):
        return list(jieba.cut(text))
    
    vectorizer = TfidfVectorizer(tokenizer=tokenize, stop_words=['的', '是', '在', '了', '和', '与', '或', '等', '也', '都', '就', '但', '很', '太', '最', '更'], min_df=1)
    
    try:
        tfidf_matrix = vectorizer.fit_transform(valid_responses['clean_text'])
    except:
        return []
    
    if n_clusters is None:
        n_clusters = max(1, min(len(valid_responses) // 5, 10))
        n_clusters = min(n_clusters, len(valid_responses))
    
    if n_clusters < 1:
        n_clusters = 1
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(tfidf_matrix)
    
    clusters = []
    for cluster_id in range(n_clusters):
        cluster_mask = labels == cluster_id
        cluster_indices = valid_responses[cluster_mask].index.tolist()
        
        if len(cluster_indices) == 0:
            continue
        
        cluster_texts = valid_responses.loc[cluster_indices, 'clean_text'].tolist()
        cluster_original_ids = valid_responses.loc[cluster_indices, 'id'].tolist()
        
        combined_text = ' '.join(cluster_texts)
        cluster_keywords = extract_keywords(combined_text, top_k=8)
        
        centroid = kmeans.cluster_centers_[cluster_id].reshape(1, -1)
        cluster_tfidf = tfidf_matrix[cluster_mask]
        similarities = cosine_similarity(centroid, cluster_tfidf)[0]
        representative_idx = np.argmax(similarities)
        representative_text = cluster_texts[representative_idx]
        representative_original_id = cluster_original_ids[representative_idx]
        
        cluster = {
            'cluster_id': f'cluster_{cluster_id}',
            'size': len(cluster_indices),
            'representative': representative_text,
            'representative_original_id': representative_original_id,
            'keywords': cluster_keywords,
            'response_ids': cluster_original_ids,
            'is_small_cluster': len(cluster_indices) <= 2
        }
        clusters.append(cluster)
    
    if len(empty_responses) > 0:
        empty_cluster = {
            'cluster_id': 'cluster_empty',
            'size': len(empty_responses),
            'representative': '[空文本]',
            'representative_original_id': empty_responses.iloc[0]['id'] if len(empty_responses) > 0 else None,
            'keywords': [],
            'response_ids': empty_responses['id'].tolist(),
            'is_small_cluster': True,
            'is_empty_cluster': True
        }
        clusters.append(empty_cluster)
    
    return clusters

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': '服务运行正常'})

@app.route('/api/upload/survey', methods=['POST'])
def upload_survey():
    global survey_data
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        df = pd.read_csv(file)
        df = df.reset_index()
        df.rename(columns={'index': 'original_index'}, inplace=True)
        df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
        survey_data = df
        
        return jsonify({
            'message': '导入成功',
            'row_count': len(df),
            'columns': list(df.columns),
            'sample_rows': df.head(3).to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({'error': f'文件解析失败: {str(e)}'}), 400

@app.route('/api/upload/taxonomy', methods=['POST'])
def upload_taxonomy():
    global taxonomy_data
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        if file.filename.endswith('.yaml') or file.filename.endswith('.yml'):
            taxonomy_data = yaml.safe_load(file)
        elif file.filename.endswith('.json'):
            taxonomy_data = json.load(file)
        else:
            return jsonify({'error': '不支持的文件格式，请上传 YAML 或 JSON 文件'}), 400
        
        return jsonify({
            'message': '分类体系导入成功',
            'categories': taxonomy_data.get('categories', [])
        })
    except Exception as e:
        return jsonify({'error': f'文件解析失败: {str(e)}'}), 400

@app.route('/api/upload/releases', methods=['POST'])
def upload_releases():
    global releases_data
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        releases_data = json.load(file)
        return jsonify({
            'message': '版本信息导入成功',
            'count': len(releases_data) if isinstance(releases_data, list) else 1,
            'sample': releases_data[:3] if isinstance(releases_data, list) else releases_data
        })
    except Exception as e:
        return jsonify({'error': f'文件解析失败: {str(e)}'}), 400

@app.route('/api/process/classify', methods=['POST'])
def process_classify():
    global survey_data, taxonomy_data, classification_results
    
    if survey_data.empty:
        return jsonify({'error': '请先导入问卷数据'}), 400
    
    taxonomy = taxonomy_data if taxonomy_data else DEFAULT_TAXONOMY
    
    text_columns = [col for col in survey_data.columns 
                    if survey_data[col].dtype == 'object' 
                    and col not in ['id', 'original_index']]
    
    if not text_columns:
        return jsonify({'error': '未找到文本类型的列'}), 400
    
    results = []
    empty_count = 0
    multi_label_count = 0
    
    for idx, row in survey_data.iterrows():
        text_parts = []
        for col in text_columns:
            if pd.notna(row[col]):
                text_parts.append(str(row[col]))
        
        combined_text = ' '.join(text_parts)
        clean_text_val = clean_text(combined_text)
        
        if not clean_text_val:
            empty_count += 1
            result = {
                'id': row['id'],
                'original_index': row['original_index'],
                'original_text': combined_text,
                'clean_text': '',
                'is_empty': True,
                'classification': {
                    'category': 'empty',
                    'confidence': 0,
                    'keywords': [],
                    'reason': '文本为空，请检查原始数据'
                },
                'reviewed': False,
                'review_category': None,
                'review_note': None,
                'conflict_info': None
            }
        else:
            classification = classify_response(clean_text_val, taxonomy)
            
            has_conflict = False
            conflict_categories = []
            categories = taxonomy.get('categories', DEFAULT_TAXONOMY['categories'])
            
            matched_cats = set()
            for cat in categories:
                cat_id = cat.get('id')
                keywords = [k.lower() for k in cat.get('keywords', [])]
                text_lower = clean_text_val.lower()
                for kw in keywords:
                    if kw in text_lower:
                        matched_cats.add(cat_id)
                        break
            
            if len(matched_cats) > 1:
                has_conflict = True
                conflict_categories = list(matched_cats)
                multi_label_count += 1
            
            result = {
                'id': row['id'],
                'original_index': row['original_index'],
                'original_text': combined_text,
                'clean_text': clean_text_val,
                'is_empty': False,
                'classification': classification,
                'reviewed': False,
                'review_category': None,
                'review_note': None,
                'conflict_info': {
                    'has_conflict': has_conflict,
                    'conflict_categories': conflict_categories
                } if has_conflict else None
            }
        
        results.append(result)
    
    classification_results = results
    
    category_stats = {}
    for r in results:
        cat = r['classification']['category']
        if cat not in category_stats:
            category_stats[cat] = 0
        category_stats[cat] += 1
    
    return jsonify({
        'message': '分类完成',
        'total': len(results),
        'empty_count': empty_count,
        'multi_label_count': multi_label_count,
        'category_stats': category_stats,
        'sample_results': results[:5]
    })

@app.route('/api/process/cluster', methods=['POST'])
def process_cluster():
    global classification_results, cluster_results
    
    if not classification_results:
        return jsonify({'error': '请先执行分类'}), 400
    
    df = pd.DataFrame(classification_results)
    
    n_clusters = request.json.get('n_clusters') if request.is_json else None
    
    clusters = cluster_responses(df, n_clusters)
    cluster_results = clusters
    
    small_clusters = [c for c in clusters if c.get('is_small_cluster', False) and not c.get('is_empty_cluster', False)]
    empty_cluster = [c for c in clusters if c.get('is_empty_cluster', False)]
    
    return jsonify({
        'message': '聚类完成',
        'total_clusters': len(clusters),
        'small_clusters_count': len(small_clusters),
        'has_empty_cluster': len(empty_cluster) > 0,
        'clusters': clusters
    })

@app.route('/api/data/responses', methods=['GET'])
def get_responses():
    global classification_results, cluster_results
    
    if not classification_results:
        return jsonify({'error': '没有数据，请先导入并处理'}), 400
    
    category = request.args.get('category')
    cluster_id = request.args.get('cluster_id')
    has_conflict = request.args.get('has_conflict')
    is_empty = request.args.get('is_empty')
    is_reviewed = request.args.get('is_reviewed')
    
    filtered = classification_results
    
    if category:
        filtered = [r for r in filtered if r['classification']['category'] == category]
    
    if has_conflict and has_conflict.lower() == 'true':
        filtered = [r for r in filtered if r.get('conflict_info') and r['conflict_info'].get('has_conflict')]
    
    if is_empty and is_empty.lower() == 'true':
        filtered = [r for r in filtered if r.get('is_empty')]
    
    if is_reviewed is not None:
        reviewed_val = is_reviewed.lower() == 'true'
        filtered = [r for r in filtered if r.get('reviewed') == reviewed_val]
    
    if cluster_id and cluster_results:
        cluster = next((c for c in cluster_results if c['cluster_id'] == cluster_id), None)
        if cluster:
            cluster_ids = cluster['response_ids']
            filtered = [r for r in filtered if r['id'] in cluster_ids]
    
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size
    
    paginated = filtered[start:end]
    
    return jsonify({
        'total': len(filtered),
        'page': page,
        'page_size': page_size,
        'responses': paginated
    })

@app.route('/api/data/clusters', methods=['GET'])
def get_clusters():
    global cluster_results
    
    if not cluster_results:
        return jsonify({'error': '没有聚类结果'}), 400
    
    return jsonify({
        'clusters': cluster_results
    })

@app.route('/api/data/response/<response_id>', methods=['GET'])
def get_response_detail(response_id):
    global classification_results, cluster_results
    
    response = next((r for r in classification_results if r['id'] == response_id), None)
    if not response:
        return jsonify({'error': '未找到该反馈'}), 404
    
    similar_responses = []
    current_cluster = None
    
    if cluster_results:
        for cluster in cluster_results:
            if response_id in cluster['response_ids']:
                current_cluster = cluster
                for other_id in cluster['response_ids']:
                    if other_id != response_id:
                        other = next((r for r in classification_results if r['id'] == other_id), None)
                        if other:
                            similar_responses.append({
                                'id': other['id'],
                                'text': other['clean_text'],
                                'category': other['classification']['category']
                            })
                break
    
    return jsonify({
        'response': response,
        'similar_responses': similar_responses,
        'cluster': current_cluster
    })

@app.route('/api/review/response/<response_id>', methods=['POST'])
def review_response(response_id):
    global classification_results, review_trail
    
    response = next((r for r in classification_results if r['id'] == response_id), None)
    if not response:
        return jsonify({'error': '未找到该反馈'}), 404
    
    data = request.json if request.is_json else {}
    new_category = data.get('category')
    review_note = data.get('note', '')
    
    if not new_category:
        return jsonify({'error': '请提供新的分类'}), 400
    
    old_category = response['classification']['category']
    response['reviewed'] = True
    response['review_category'] = new_category
    response['review_note'] = review_note
    
    review_trail.append({
        'id': str(uuid.uuid4()),
        'action': 'reclassify',
        'response_id': response_id,
        'old_category': old_category,
        'new_category': new_category,
        'note': review_note,
        'timestamp': datetime.now().isoformat()
    })
    
    return jsonify({
        'message': '复核完成',
        'response': response
    })

@app.route('/api/review/cluster/merge', methods=['POST'])
def merge_clusters():
    global cluster_results, classification_results, review_trail
    
    data = request.json if request.is_json else {}
    source_cluster_ids = data.get('source_cluster_ids', [])
    target_cluster_id = data.get('target_cluster_id')
    
    if len(source_cluster_ids) < 1 or not target_cluster_id:
        return jsonify({'error': '请提供源簇ID和目标簇ID'}), 400
    
    target_cluster = next((c for c in cluster_results if c['cluster_id'] == target_cluster_id), None)
    if not target_cluster:
        return jsonify({'error': '目标簇不存在'}), 404
    
    all_response_ids = set(target_cluster['response_ids'])
    all_texts = []
    
    for source_id in source_cluster_ids:
        source_cluster = next((c for c in cluster_results if c['cluster_id'] == source_id), None)
        if source_cluster:
            all_response_ids.update(source_cluster['response_ids'])
            for rid in source_cluster['response_ids']:
                resp = next((r for r in classification_results if r['id'] == rid), None)
                if resp and resp['clean_text']:
                    all_texts.append(resp['clean_text'])
    
    all_response_ids = list(all_response_ids)
    
    if all_texts:
        combined_text = ' '.join(all_texts)
        new_keywords = extract_keywords(combined_text, top_k=8)
        target_cluster['keywords'] = new_keywords
        target_cluster['size'] = len(all_response_ids)
        target_cluster['response_ids'] = all_response_ids
    
    for source_id in source_cluster_ids:
        cluster_results = [c for c in cluster_results if c['cluster_id'] != source_id]
    
    review_trail.append({
        'id': str(uuid.uuid4()),
        'action': 'merge_clusters',
        'source_cluster_ids': source_cluster_ids,
        'target_cluster_id': target_cluster_id,
        'timestamp': datetime.now().isoformat()
    })
    
    return jsonify({
        'message': '簇合并完成',
        'cluster': target_cluster,
        'remaining_clusters': len(cluster_results)
    })

@app.route('/api/review/cluster/split', methods=['POST'])
def split_cluster():
    global cluster_results, classification_results, review_trail
    
    data = request.json if request.is_json else {}
    cluster_id = data.get('cluster_id')
    response_ids_to_split = data.get('response_ids', [])
    
    if not cluster_id or len(response_ids_to_split) == 0:
        return jsonify({'error': '请提供簇ID和要拆分的反馈ID'}), 400
    
    original_cluster = next((c for c in cluster_results if c['cluster_id'] == cluster_id), None)
    if not original_cluster:
        return jsonify({'error': '簇不存在'}), 404
    
    remaining_ids = [rid for rid in original_cluster['response_ids'] if rid not in response_ids_to_split]
    
    if len(remaining_ids) == 0:
        return jsonify({'error': '拆分后原簇不能为空'}), 400
    
    split_texts = []
    for rid in response_ids_to_split:
        resp = next((r for r in classification_results if r['id'] == rid), None)
        if resp and resp['clean_text']:
            split_texts.append(resp['clean_text'])
    
    split_keywords = []
    split_representative = ''
    if split_texts:
        combined_text = ' '.join(split_texts)
        split_keywords = extract_keywords(combined_text, top_k=8)
        split_representative = split_texts[0] if split_texts else ''
    
    new_cluster_id = f'cluster_{len(cluster_results)}'
    new_cluster = {
        'cluster_id': new_cluster_id,
        'size': len(response_ids_to_split),
        'representative': split_representative,
        'representative_original_id': response_ids_to_split[0] if response_ids_to_split else None,
        'keywords': split_keywords,
        'response_ids': response_ids_to_split,
        'is_small_cluster': len(response_ids_to_split) <= 2
    }
    
    original_cluster['response_ids'] = remaining_ids
    original_cluster['size'] = len(remaining_ids)
    
    remaining_texts = []
    for rid in remaining_ids:
        resp = next((r for r in classification_results if r['id'] == rid), None)
        if resp and resp['clean_text']:
            remaining_texts.append(resp['clean_text'])
    
    if remaining_texts:
        combined_text = ' '.join(remaining_texts)
        original_cluster['keywords'] = extract_keywords(combined_text, top_k=8)
        original_cluster['representative'] = remaining_texts[0]
    
    cluster_results.append(new_cluster)
    
    review_trail.append({
        'id': str(uuid.uuid4()),
        'action': 'split_cluster',
        'original_cluster_id': cluster_id,
        'new_cluster_id': new_cluster_id,
        'split_response_ids': response_ids_to_split,
        'timestamp': datetime.now().isoformat()
    })
    
    return jsonify({
        'message': '簇拆分完成',
        'original_cluster': original_cluster,
        'new_cluster': new_cluster
    })

@app.route('/api/data/categories', methods=['GET'])
def get_categories():
    global taxonomy_data
    
    taxonomy = taxonomy_data if taxonomy_data else DEFAULT_TAXONOMY
    return jsonify({
        'categories': taxonomy.get('categories', [])
    })

@app.route('/api/export/classified_csv', methods=['GET'])
def export_classified_csv():
    global classification_results, taxonomy_data, releases_data
    
    if not classification_results:
        return jsonify({'error': '没有数据可导出'}), 400
    
    taxonomy = taxonomy_data if taxonomy_data else DEFAULT_TAXONOMY
    categories = taxonomy.get('categories', DEFAULT_TAXONOMY['categories'])
    category_map = {c.get('id'): c.get('name', c.get('id')) for c in categories}
    category_map['empty'] = '空文本'
    
    export_data = []
    for r in classification_results:
        final_category = r.get('review_category') if r.get('reviewed') else r['classification']['category']
        row = {
            'ID': r['id'],
            '原始序号': r['original_index'],
            '原始文本': r['original_text'],
            '清洗后文本': r['clean_text'],
            '自动分类': category_map.get(r['classification']['category'], r['classification']['category']),
            '自动分类置信度': f"{r['classification']['confidence']:.2%}",
            '匹配关键词': ', '.join(r['classification']['keywords']),
            '分类理由': r['classification']['reason'],
            '是否冲突': '是' if r.get('conflict_info') and r['conflict_info'].get('has_conflict') else '否',
            '冲突分类': ', '.join([category_map.get(c, c) for c in r['conflict_info']['conflict_categories']]) if r.get('conflict_info') else '',
            '是否已复核': '是' if r.get('reviewed') else '否',
            '复核后分类': category_map.get(r.get('review_category'), r.get('review_category', '')) if r.get('reviewed') else '',
            '复核备注': r.get('review_note', '')
        }
        export_data.append(row)
    
    df = pd.DataFrame(export_data)
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'classified.csv')
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    return send_file(output_path, as_attachment=True, download_name='classified.csv', mimetype='text/csv')

@app.route('/api/export/clusters_json', methods=['GET'])
def export_clusters_json():
    global cluster_results, classification_results, taxonomy_data
    
    if not cluster_results:
        return jsonify({'error': '没有聚类数据可导出'}), 400
    
    taxonomy = taxonomy_data if taxonomy_data else DEFAULT_TAXONOMY
    categories = taxonomy.get('categories', DEFAULT_TAXONOMY['categories'])
    category_map = {c.get('id'): c.get('name', c.get('id')) for c in categories}
    category_map['empty'] = '空文本'
    
    export_clusters = []
    for cluster in cluster_results:
        cluster_responses = []
        for rid in cluster['response_ids']:
            r = next((resp for resp in classification_results if resp['id'] == rid), None)
            if r:
                final_category = r.get('review_category') if r.get('reviewed') else r['classification']['category']
                cluster_responses.append({
                    'id': r['id'],
                    'text': r['clean_text'],
                    'category': category_map.get(final_category, final_category),
                    'is_reviewed': r.get('reviewed', False)
                })
        
        export_cluster = {
            'cluster_id': cluster['cluster_id'],
            'size': cluster['size'],
            'representative_text': cluster['representative'],
            'keywords': cluster['keywords'],
            'is_small_cluster': cluster.get('is_small_cluster', False),
            'is_empty_cluster': cluster.get('is_empty_cluster', False),
            'responses': cluster_responses
        }
        export_clusters.append(export_cluster)
    
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'clusters.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_clusters, f, ensure_ascii=False, indent=2)
    
    return send_file(output_path, as_attachment=True, download_name='clusters.json', mimetype='application/json')

@app.route('/api/export/review_md', methods=['GET'])
def export_review_md():
    global classification_results, cluster_results, taxonomy_data, releases_data, review_trail
    
    taxonomy = taxonomy_data if taxonomy_data else DEFAULT_TAXONOMY
    categories = taxonomy.get('categories', DEFAULT_TAXONOMY['categories'])
    category_map = {c.get('id'): c.get('name', c.get('id')) for c in categories}
    category_map['empty'] = '空文本'
    
    total_responses = len(classification_results)
    reviewed_count = sum(1 for r in classification_results if r.get('reviewed'))
    empty_count = sum(1 for r in classification_results if r.get('is_empty'))
    conflict_count = sum(1 for r in classification_results if r.get('conflict_info') and r['conflict_info'].get('has_conflict'))
    
    category_stats = {}
    for r in classification_results:
        final_category = r.get('review_category') if r.get('reviewed') else r['classification']['category']
        if final_category not in category_stats:
            category_stats[final_category] = {'count': 0, 'reviewed': 0}
        category_stats[final_category]['count'] += 1
        if r.get('reviewed'):
            category_stats[final_category]['reviewed'] += 1
    
    md_content = f"""# 产品试用问卷开放反馈归因复盘报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 一、概览

| 指标 | 数值 |
|------|------|
| 总反馈数 | {total_responses} |
| 已复核数 | {reviewed_count} ({reviewed_count/total_responses*100:.1f}%) |
| 空文本数 | {empty_count} |
| 多标签冲突数 | {conflict_count} |
| 簇数量 | {len(cluster_results)} |

## 二、分类分布

"""
    
    for cat_id, stats in category_stats.items():
        cat_name = category_map.get(cat_id, cat_id)
        count = stats['count']
        reviewed = stats['reviewed']
        pct = count / total_responses * 100
        md_content += f"- **{cat_name}**: {count} 条 ({pct:.1f}%)，已复核 {reviewed} 条\n"
    
    md_content += """
## 三、簇分析

"""
    
    for i, cluster in enumerate(cluster_results):
        cluster_label = f"簇 {i+1} ({cluster['cluster_id']})"
        if cluster.get('is_empty_cluster'):
            cluster_label += " [空文本簇]"
        elif cluster.get('is_small_cluster'):
            cluster_label += " [小簇]"
        
        md_content += f"### {cluster_label}\n\n"
        md_content += f"- **大小**: {cluster['size']} 条\n"
        md_content += f"- **代表句**: {cluster['representative']}\n"
        md_content += f"- **关键词**: {', '.join(cluster['keywords'])}\n\n"
        
        if cluster['size'] > 0 and cluster['response_ids']:
            md_content += "**样本反馈**:\n\n"
            sample_count = min(3, cluster['size'])
            for j, rid in enumerate(cluster['response_ids'][:sample_count]):
                r = next((resp for resp in classification_results if resp['id'] == rid), None)
                if r:
                    final_category = r.get('review_category') if r.get('reviewed') else r['classification']['category']
                    cat_name = category_map.get(final_category, final_category)
                    status = "[已复核]" if r.get('reviewed') else ""
                    md_content += f"{j+1}. {r['clean_text']} ({cat_name}) {status}\n"
            
            if cluster['size'] > sample_count:
                md_content += f"\n... 还有 {cluster['size'] - sample_count} 条\n"
            
            md_content += "\n"
    
    if review_trail:
        md_content += """
## 四、复核操作痕迹

"""
        for trail in review_trail:
            action = trail.get('action', '')
            timestamp = trail.get('timestamp', '')
            
            if action == 'reclassify':
                old_cat = category_map.get(trail.get('old_category'), trail.get('old_category'))
                new_cat = category_map.get(trail.get('new_category'), trail.get('new_category'))
                note = trail.get('note', '')
                md_content += f"- [{timestamp}] 重新分类: {old_cat} → {new_cat}"
                if note:
                    md_content += f" (备注: {note})"
                md_content += "\n"
            elif action == 'merge_clusters':
                sources = ', '.join(trail.get('source_cluster_ids', []))
                target = trail.get('target_cluster_id')
                md_content += f"- [{timestamp}] 合并簇: {sources} → {target}\n"
            elif action == 'split_cluster':
                original = trail.get('original_cluster_id')
                new = trail.get('new_cluster_id')
                md_content += f"- [{timestamp}] 拆分簇: {original} → {new}\n"
        
        md_content += "\n"
    
    md_content += """
---
*本报告由产品试用问卷开放反馈归因复盘台自动生成*
"""
    
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], 'review.md')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    return send_file(output_path, as_attachment=True, download_name='review.md', mimetype='text/markdown')

@app.route('/api/load-samples', methods=['POST'])
def load_samples():
    global survey_data, taxonomy_data, releases_data
    
    sample_survey_path = os.path.join(SAMPLE_FOLDER, 'survey_responses.csv')
    sample_taxonomy_path = os.path.join(SAMPLE_FOLDER, 'taxonomy.yaml')
    sample_releases_path = os.path.join(SAMPLE_FOLDER, 'releases.json')
    
    try:
        if os.path.exists(sample_survey_path):
            df = pd.read_csv(sample_survey_path)
            df = df.reset_index()
            df.rename(columns={'index': 'original_index'}, inplace=True)
            df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
            survey_data = df
        
        if os.path.exists(sample_taxonomy_path):
            with open(sample_taxonomy_path, 'r', encoding='utf-8') as f:
                taxonomy_data = yaml.safe_load(f)
        
        if os.path.exists(sample_releases_path):
            with open(sample_releases_path, 'r', encoding='utf-8') as f:
                releases_data = json.load(f)
        
        return jsonify({
            'message': 'Sample 数据加载成功',
            'survey_count': len(survey_data),
            'taxonomy_categories': len(taxonomy_data.get('categories', [])),
            'releases_count': len(releases_data) if isinstance(releases_data, list) else 1
        })
    except Exception as e:
        return jsonify({'error': f'加载 Sample 数据失败: {str(e)}'}), 500

@app.route('/')
def index():
    return send_file('static/index.html')

if __name__ == '__main__':
    import sys
    port = 5001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except:
            pass
    
    print("=" * 60)
    print("  产品试用问卷开放反馈归因复盘台")
    print("  Product Trial Survey Feedback Attribution Dashboard")
    print("=" * 60)
    print()
    print(f"  请在浏览器中访问: http://localhost:{port}")
    print("  按 Ctrl+C 停止服务")
    print()
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=port)
