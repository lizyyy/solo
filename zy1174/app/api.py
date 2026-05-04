from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional

from app import db
from app.models import Corpus, VectorVersion, QueryRecord, SimilarityResult, Annotation
from app.utils import (
    TextProcessor,
    VectorizerFactory,
    VectorRetriever,
    EvaluationMetrics,
    VectorDimensionAnalyzer,
    DataImporter,
    ReportExporter
)
from config import Config

api = Blueprint('api', __name__)

current_vectorizer = None
current_retriever = None
current_corpus_vectors = None
current_vector_version_id = None

def allowed_file(filename: str) -> bool:
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@api.route('/corpus', methods=['GET'])
def get_corpus():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        pagination = Corpus.query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'success': True,
            'data': {
                'items': [item.to_dict() for item in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus/<int:doc_id>', methods=['GET'])
def get_document(doc_id: int):
    try:
        doc = Corpus.query.get_or_404(doc_id)
        return jsonify({
            'success': True,
            'data': doc.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus/upload', methods=['POST'])
def upload_corpus():
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file part'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No selected file'
            }), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            upload_dir = Config.UPLOAD_FOLDER
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, filename)
            file.save(file_path)
            
            try:
                documents = DataImporter.import_file(file_path)
                
                for doc in documents:
                    existing = Corpus.query.filter_by(doc_id=doc['doc_id']).first()
                    if not existing:
                        new_doc = Corpus(
                            doc_id=doc['doc_id'],
                            content=doc['content'],
                            metadata=doc.get('metadata', '{}')
                        )
                        db.session.add(new_doc)
                
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'data': {
                        'filename': filename,
                        'imported_count': len(documents),
                        'message': f'Successfully imported {len(documents)} documents'
                    }
                })
                
            except Exception as e:
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'error': f'Import failed: {str(e)}'
                }), 500
            finally:
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        return jsonify({
            'success': False,
            'error': 'File type not allowed'
        }), 400
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus', methods=['POST'])
def add_document():
    try:
        data = request.get_json()
        
        if not data or 'content' not in data:
            return jsonify({
                'success': False,
                'error': 'Content is required'
            }), 400
        
        doc_id = data.get('doc_id', f"doc_{datetime.utcnow().timestamp()}")
        
        existing = Corpus.query.filter_by(doc_id=doc_id).first()
        if existing:
            return jsonify({
                'success': False,
                'error': f'Document with doc_id {doc_id} already exists'
            }), 400
        
        new_doc = Corpus(
            doc_id=doc_id,
            content=data['content'],
            metadata=json.dumps(data.get('metadata', {}), ensure_ascii=False)
        )
        
        db.session.add(new_doc)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': new_doc.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus/<int:doc_id>', methods=['PUT'])
def update_document(doc_id: int):
    try:
        doc = Corpus.query.get_or_404(doc_id)
        data = request.get_json()
        
        if 'content' in data:
            doc.content = data['content']
        
        if 'metadata' in data:
            doc.metadata = json.dumps(data['metadata'], ensure_ascii=False)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': doc.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id: int):
    try:
        doc = Corpus.query.get_or_404(doc_id)
        
        SimilarityResult.query.filter_by(corpus_id=doc.id).delete()
        Annotation.query.filter_by(corpus_id=doc.id).delete()
        
        db.session.delete(doc)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Document deleted successfully'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/corpus/stats', methods=['GET'])
def get_corpus_stats():
    try:
        total_docs = Corpus.query.count()
        
        if total_docs == 0:
            return jsonify({
                'success': True,
                'data': {
                    'total_docs': 0,
                    'total_tokens': 0,
                    'avg_doc_length': 0,
                    'vocab_size': 0
                }
            })
        
        all_docs = Corpus.query.all()
        contents = [doc.content for doc in all_docs]
        
        processor = TextProcessor()
        token_lists = processor.process_batch(contents)
        
        total_tokens = sum(len(tokens) for tokens in token_lists)
        avg_doc_length = total_tokens / total_docs if total_docs > 0 else 0
        
        vocabulary = set()
        for tokens in token_lists:
            vocabulary.update(tokens)
        
        return jsonify({
            'success': True,
            'data': {
                'total_docs': total_docs,
                'total_tokens': total_tokens,
                'avg_doc_length': avg_doc_length,
                'vocab_size': len(vocabulary)
            }
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/vectorize', methods=['POST'])
def vectorize():
    global current_vectorizer, current_retriever, current_corpus_vectors, current_vector_version_id
    
    try:
        data = request.get_json() or {}
        
        tokenizer = data.get('tokenizer', Config.DEFAULT_TOKENIZER)
        stopword_lang = data.get('stopword_lang', Config.DEFAULT_STOPWORD_LANG)
        vectorization = data.get('vectorization', Config.DEFAULT_VECTORIZATION)
        normalize = data.get('normalize', Config.DEFAULT_NORMALIZE)
        version_name = data.get('version_name', f"v_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")
        
        custom_stopwords = data.get('custom_stopwords', [])
        
        all_docs = Corpus.query.all()
        if not all_docs:
            return jsonify({
                'success': False,
                'error': 'No documents in corpus. Please upload documents first.'
            }), 400
        
        contents = [doc.content for doc in all_docs]
        doc_ids = [doc.id for doc in all_docs]
        
        vectorizer_kwargs = {
            'tokenizer_type': tokenizer,
            'stopword_lang': stopword_lang,
            'custom_stopwords': custom_stopwords,
            'random_seed': Config.RANDOM_SEED
        }
        
        if vectorization == 'embedding':
            vectorizer_kwargs['embedding_dim'] = data.get('embedding_dim', 100)
        
        current_vectorizer = VectorizerFactory.create(vectorization, **vectorizer_kwargs)
        current_corpus_vectors = current_vectorizer.fit_transform(contents, normalize_vectors=normalize)
        
        current_retriever = VectorRetriever(metric='cosine')
        current_retriever.index(current_corpus_vectors, ids=doc_ids, contents=contents)
        
        vector_version = VectorVersion(
            version_name=version_name,
            tokenizer=tokenizer,
            stopword_lang=stopword_lang,
            vectorization=vectorization,
            normalize=normalize,
            dimensions=current_vectorizer.get_dimensions(),
            vocabulary_size=current_vectorizer.get_vocabulary_size()
        )
        
        db.session.add(vector_version)
        db.session.commit()
        current_vector_version_id = vector_version.id
        
        return jsonify({
            'success': True,
            'data': {
                'vector_version': vector_version.to_dict(),
                'message': f'Successfully vectorized {len(all_docs)} documents',
                'dimensions': current_vectorizer.get_dimensions(),
                'vocabulary_size': current_vectorizer.get_vocabulary_size()
            }
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/vector-versions', methods=['GET'])
def get_vector_versions():
    try:
        versions = VectorVersion.query.order_by(VectorVersion.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [v.to_dict() for v in versions]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/search', methods=['POST'])
def search():
    global current_retriever, current_vectorizer, current_vector_version_id
    
    try:
        if current_retriever is None or current_vectorizer is None:
            return jsonify({
                'success': False,
                'error': 'Vectorizer not initialized. Please call /api/vectorize first.'
            }), 400
        
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({
                'success': False,
                'error': 'Query text is required'
            }), 400
        
        query_text = data['query']
        top_k = data.get('top_k', Config.DEFAULT_TOP_K)
        
        if top_k <= 0:
            return jsonify({
                'success': False,
                'error': 'top_k must be a positive integer'
            }), 400
        
        query_vector = current_vectorizer.transform([query_text], normalize_vectors=True)[0]
        
        results = current_retriever.search(query_vector, top_k=top_k)
        
        query_record = QueryRecord(
            query_text=query_text,
            vector_version_id=current_vector_version_id,
            top_k=top_k
        )
        db.session.add(query_record)
        db.session.flush()
        
        for result in results:
            sim_result = SimilarityResult(
                query_record_id=query_record.id,
                corpus_id=result['id'],
                similarity_score=result['similarity_score'],
                rank=result['rank']
            )
            db.session.add(sim_result)
        
        db.session.commit()
        
        for result in results:
            doc = Corpus.query.get(result['id'])
            if doc:
                result['doc_id'] = doc.doc_id
                result['content'] = doc.content
                result['metadata'] = doc.metadata
        
        return jsonify({
            'success': True,
            'data': {
                'query': query_text,
                'query_record_id': query_record.id,
                'top_k': top_k,
                'results': results
            }
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/similarity-matrix', methods=['GET'])
def get_similarity_matrix():
    global current_retriever
    
    try:
        if current_retriever is None:
            return jsonify({
                'success': False,
                'error': 'Vectorizer not initialized. Please call /api/vectorize first.'
            }), 400
        
        limit = request.args.get('limit', 50, type=int)
        
        similarity_matrix = current_retriever.get_similarity_matrix()
        
        if similarity_matrix.shape[0] > limit:
            similarity_matrix = similarity_matrix[:limit, :limit]
        
        return jsonify({
            'success': True,
            'data': {
                'matrix': similarity_matrix.tolist(),
                'size': similarity_matrix.shape[0],
                'limited': similarity_matrix.shape[0] < current_retriever.corpus_vectors.shape[0]
            }
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/dimension-analysis', methods=['POST'])
def analyze_dimensions():
    global current_vectorizer
    
    try:
        if current_vectorizer is None:
            return jsonify({
                'success': False,
                'error': 'Vectorizer not initialized. Please call /api/vectorize first.'
            }), 400
        
        data = request.get_json() or {}
        
        analyzer = VectorDimensionAnalyzer(current_vectorizer)
        
        response_data = {}
        
        if 'query' in data:
            query_text = data['query']
            query_vector = current_vectorizer.transform([query_text], normalize_vectors=True)[0]
            query_impact = analyzer.analyze_query_impact(query_vector, top_k=data.get('top_k', 20))
            response_data['query_impact'] = query_impact
        
        if data.get('include_corpus', False):
            corpus_analysis = analyzer.analyze_corpus_dimensions(current_corpus_vectors)
            response_data['corpus_analysis'] = corpus_analysis
        
        return jsonify({
            'success': True,
            'data': response_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/annotations', methods=['POST'])
def add_annotation():
    try:
        data = request.get_json()
        
        required_fields = ['query_record_id', 'corpus_id', 'relevance']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'{field} is required'
                }), 400
        
        relevance = data['relevance']
        if relevance not in [0, 1, 2, 3]:
            return jsonify({
                'success': False,
                'error': 'Relevance must be 0 (irrelevant), 1 (partially relevant), 2 (relevant), or 3 (highly relevant)'
            }), 400
        
        existing = Annotation.query.filter_by(
            query_record_id=data['query_record_id'],
            corpus_id=data['corpus_id']
        ).first()
        
        if existing:
            existing.relevance = relevance
            existing.notes = data.get('notes')
        else:
            annotation = Annotation(
                query_record_id=data['query_record_id'],
                corpus_id=data['corpus_id'],
                relevance=relevance,
                notes=data.get('notes')
            )
            db.session.add(annotation)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Annotation saved successfully'
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/annotations/<int:query_record_id>', methods=['GET'])
def get_annotations(query_record_id: int):
    try:
        annotations = Annotation.query.filter_by(query_record_id=query_record_id).all()
        
        return jsonify({
            'success': True,
            'data': [a.to_dict() for a in annotations]
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/evaluate', methods=['POST'])
def evaluate():
    try:
        data = request.get_json() or {}
        
        query_record_ids = data.get('query_record_ids', [])
        
        if not query_record_ids:
            annotations = Annotation.query.all()
            query_record_ids = list(set(a.query_record_id for a in annotations))
        
        if not query_record_ids:
            return jsonify({
                'success': False,
                'error': 'No annotations found for evaluation'
            }), 400
        
        all_relevant_ids = []
        all_retrieved_ids = []
        all_relevance_scores = []
        
        for qr_id in query_record_ids:
            query_record = QueryRecord.query.get(qr_id)
            if not query_record:
                continue
            
            annotations = Annotation.query.filter_by(query_record_id=qr_id).all()
            if not annotations:
                continue
            
            results = SimilarityResult.query.filter_by(query_record_id=qr_id).order_by(SimilarityResult.rank).all()
            
            relevant_ids = [a.corpus_id for a in annotations if a.relevance >= 2]
            retrieved_ids = [r.corpus_id for r in results]
            
            all_relevant_ids.append(relevant_ids)
            all_retrieved_ids.append(retrieved_ids)
            
            relevance_map = {a.corpus_id: a.relevance for a in annotations}
            relevance_scores = [relevance_map.get(cid, 0) for cid in retrieved_ids]
            all_relevance_scores.append(relevance_scores)
        
        if not all_relevant_ids:
            return jsonify({
                'success': False,
                'error': 'No valid query records with annotations'
            }), 400
        
        top_k = data.get('top_k', 5)
        
        all_precisions = []
        all_recalls = []
        all_f1s = []
        
        for rel_ids, ret_ids in zip(all_relevant_ids, all_retrieved_ids):
            if not rel_ids:
                continue
            
            precision = EvaluationMetrics.precision_at_k(rel_ids, ret_ids, top_k)
            recall = EvaluationMetrics.recall_at_k(rel_ids, ret_ids, top_k)
            f1 = EvaluationMetrics.f1_score(precision, recall)
            
            all_precisions.append(precision)
            all_recalls.append(recall)
            all_f1s.append(f1)
        
        map_score = EvaluationMetrics.mean_average_precision(
            all_relevant_ids, all_retrieved_ids, k=top_k
        )
        
        mrr_score = EvaluationMetrics.mean_reciprocal_rank(
            all_relevant_ids, all_retrieved_ids
        )
        
        ndcg_scores = []
        for relevance_scores in all_relevance_scores:
            if sum(relevance_scores) > 0:
                ndcg = EvaluationMetrics.ndcg_at_k(
                    relevance_scores, list(range(len(relevance_scores))), top_k
                )
                ndcg_scores.append(ndcg)
        
        avg_ndcg = np.mean(ndcg_scores) if ndcg_scores else 0
        
        metrics = {
            'num_queries': len(all_relevant_ids),
            'top_k': top_k,
            'avg_precision': float(np.mean(all_precisions)) if all_precisions else 0,
            'avg_recall': float(np.mean(all_recalls)) if all_recalls else 0,
            'avg_f1': float(np.mean(all_f1s)) if all_f1s else 0,
            'map': float(map_score),
            'mrr': float(mrr_score),
            'avg_ndcg': float(avg_ndcg)
        }
        
        return jsonify({
            'success': True,
            'data': metrics
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/export/report', methods=['POST'])
def export_report():
    try:
        data = request.get_json() or {}
        format = data.get('format', 'markdown')
        
        all_docs = Corpus.query.all()
        contents = [doc.content for doc in all_docs]
        
        processor = TextProcessor()
        token_lists = processor.process_batch(contents)
        total_tokens = sum(len(tokens) for tokens in token_lists)
        avg_doc_length = total_tokens / len(all_docs) if all_docs else 0
        
        vocabulary = set()
        for tokens in token_lists:
            vocabulary.update(tokens)
        
        corpus_stats = {
            'total_docs': len(all_docs),
            'total_tokens': total_tokens,
            'avg_doc_length': avg_doc_length,
            'vocab_size': len(vocabulary)
        }
        
        vectorization_config = {
            'tokenizer': data.get('tokenizer', Config.DEFAULT_TOKENIZER),
            'stopword_lang': data.get('stopword_lang', Config.DEFAULT_STOPWORD_LANG),
            'vectorization': data.get('vectorization', Config.DEFAULT_VECTORIZATION),
            'dimensions': current_vectorizer.get_dimensions() if current_vectorizer else 0,
            'normalize': data.get('normalize', Config.DEFAULT_NORMALIZE),
            'top_k': data.get('top_k', Config.DEFAULT_TOP_K)
        }
        
        query_results = []
        query_record_ids = data.get('query_record_ids', [])
        
        if not query_record_ids:
            recent_queries = QueryRecord.query.order_by(QueryRecord.created_at.desc()).limit(10).all()
            query_record_ids = [q.id for q in recent_queries]
        
        for qr_id in query_record_ids:
            query_record = QueryRecord.query.get(qr_id)
            if not query_record:
                continue
            
            results = SimilarityResult.query.filter_by(query_record_id=qr_id).order_by(SimilarityResult.rank).all()
            
            result_items = []
            for r in results:
                doc = Corpus.query.get(r.corpus_id)
                result_items.append({
                    'rank': r.rank,
                    'id': r.corpus_id,
                    'similarity_score': r.similarity_score,
                    'content': doc.content if doc else ''
                })
            
            query_results.append({
                'query_text': query_record.query_text,
                'results': result_items
            })
        
        evaluation_metrics = None
        if data.get('include_evaluation', True) and query_record_ids:
            try:
                all_relevant_ids = []
                all_retrieved_ids = []
                
                for qr_id in query_record_ids:
                    annotations = Annotation.query.filter_by(query_record_id=qr_id).all()
                    results = SimilarityResult.query.filter_by(query_record_id=qr_id).order_by(SimilarityResult.rank).all()
                    
                    relevant_ids = [a.corpus_id for a in annotations if a.relevance >= 2]
                    retrieved_ids = [r.corpus_id for r in results]
                    
                    if relevant_ids:
                        all_relevant_ids.append(relevant_ids)
                        all_retrieved_ids.append(retrieved_ids)
                
                if all_relevant_ids:
                    top_k = data.get('top_k', 5)
                    map_score = EvaluationMetrics.mean_average_precision(
                        all_relevant_ids, all_retrieved_ids, k=top_k
                    )
                    mrr_score = EvaluationMetrics.mean_reciprocal_rank(
                        all_relevant_ids, all_retrieved_ids
                    )
                    
                    evaluation_metrics = {
                        'num_evaluated_queries': len(all_relevant_ids),
                        'MAP': float(map_score),
                        'MRR': float(mrr_score)
                    }
            except:
                pass
        
        similarity_matrix = None
        if data.get('include_similarity_matrix', False) and current_retriever:
            try:
                matrix = current_retriever.get_similarity_matrix()
                if matrix.shape[0] > 20:
                    matrix = matrix[:20, :20]
                similarity_matrix = matrix.tolist()
            except:
                pass
        
        dimension_analysis = None
        if data.get('include_dimension_analysis', False) and current_vectorizer:
            try:
                analyzer = VectorDimensionAnalyzer(current_vectorizer)
                if current_corpus_vectors is not None:
                    dimension_analysis = analyzer.analyze_corpus_dimensions(current_corpus_vectors)
            except:
                pass
        
        if format == 'markdown':
            report_content = ReportExporter.generate_markdown_report(
                corpus_stats=corpus_stats,
                vectorization_config=vectorization_config,
                query_results=query_results,
                evaluation_metrics=evaluation_metrics,
                similarity_matrix=similarity_matrix,
                dimension_analysis=dimension_analysis
            )
            
            filename = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
            filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
            os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(report_content)
            
            return send_file(filepath, as_attachment=True, download_name=filename)
        
        else:
            report_content = ReportExporter.generate_json_report(
                corpus_stats=corpus_stats,
                vectorization_config=vectorization_config,
                query_results=query_results,
                evaluation_metrics=evaluation_metrics,
                similarity_matrix=similarity_matrix,
                dimension_analysis=dimension_analysis
            )
            
            filename = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
            os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(report_content, f, ensure_ascii=False, indent=2)
            
            return send_file(filepath, as_attachment=True, download_name=filename)
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/query-history', methods=['GET'])
def get_query_history():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        pagination = QueryRecord.query.order_by(QueryRecord.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        items = []
        for qr in pagination.items:
            item = qr.to_dict()
            annotations = Annotation.query.filter_by(query_record_id=qr.id).all()
            item['annotation_count'] = len(annotations)
            items.append(item)
        
        return jsonify({
            'success': True,
            'data': {
                'items': items,
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    })
