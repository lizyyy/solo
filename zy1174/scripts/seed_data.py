import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Corpus, VectorVersion, QueryRecord, SimilarityResult, Annotation
from app.utils import TextProcessor, VectorizerFactory, VectorRetriever
from datetime import datetime

SEED_DATA = [
    {
        "doc_id": "seed_001",
        "content": "人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。该领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。",
        "metadata": {"category": "AI", "source": "百科"}
    },
    {
        "doc_id": "seed_002",
        "content": "机器学习是人工智能的一个重要分支，专门研究计算机怎样模拟或实现人类的学习行为，以获取新的知识或技能，重新组织已有的知识结构使之不断改善自身的性能。",
        "metadata": {"category": "AI", "source": "百科"}
    },
    {
        "doc_id": "seed_003",
        "content": "深度学习是机器学习的一个子集，它使用多层神经网络来学习数据的复杂模式。深度学习在图像识别、语音识别、自然语言处理等领域取得了重大突破。",
        "metadata": {"category": "AI", "source": "百科"}
    },
    {
        "doc_id": "seed_004",
        "content": "自然语言处理是人工智能和语言学领域的分支学科，它探讨如何处理及运用自然语言，包括让计算机理解和生成人类语言。",
        "metadata": {"category": "AI", "source": "百科"}
    },
    {
        "doc_id": "seed_005",
        "content": "Python是一种高级编程语言，以其简洁的语法和强大的功能而著称，广泛应用于数据分析、机器学习、Web开发等领域。",
        "metadata": {"category": "编程", "source": "教程"}
    },
    {
        "doc_id": "seed_006",
        "content": "JavaScript是一种轻量级的编程语言，主要用于网页开发，使网页具有交互性。它也可以用于服务器端开发(Node.js)。",
        "metadata": {"category": "编程", "source": "教程"}
    },
    {
        "doc_id": "seed_007",
        "content": "Java是一种面向对象的编程语言，具有跨平台特性，一次编写到处运行。广泛应用于企业级应用、Android开发等。",
        "metadata": {"category": "编程", "source": "教程"}
    },
    {
        "doc_id": "seed_008",
        "content": "数据库是按照数据结构来组织、存储和管理数据的仓库。常见的数据库类型有关系型数据库(MySQL, PostgreSQL)和非关系型数据库(MongoDB, Redis)。",
        "metadata": {"category": "数据库", "source": "教材"}
    },
    {
        "doc_id": "seed_009",
        "content": "SQL是结构化查询语言，用于管理关系型数据库中的数据。它可以执行数据查询、插入、更新、删除等操作。",
        "metadata": {"category": "数据库", "source": "教材"}
    },
    {
        "doc_id": "seed_010",
        "content": "云计算是一种基于互联网的计算方式，通过网络提供可扩展的弹性计算资源。主要服务模式包括IaaS、PaaS、SaaS。",
        "metadata": {"category": "云计算", "source": "白皮书"}
    }
]

def seed_database():
    app = create_app()
    
    with app.app_context():
        print("=== 开始填充种子数据 ===")
        
        existing = Corpus.query.first()
        if existing:
            print("数据库已有数据，跳过种子数据填充")
            return
        
        for item in SEED_DATA:
            doc = Corpus(
                doc_id=item["doc_id"],
                content=item["content"],
                metadata=str(item["metadata"])
            )
            db.session.add(doc)
        
        db.session.commit()
        print(f"已添加 {len(SEED_DATA)} 条文档到语料库")
        
        print("\n=== 执行示例向量化 ===")
        processor = TextProcessor(tokenizer_type='jieba', stopword_lang='chinese')
        
        all_docs = Corpus.query.all()
        contents = [doc.content for doc in all_docs]
        doc_ids = [doc.id for doc in all_docs]
        
        vectorizer = VectorizerFactory.create('tfidf', tokenizer_type='jieba', stopword_lang='chinese')
        vectors = vectorizer.fit_transform(contents, normalize_vectors=True)
        
        vector_version = VectorVersion(
            version_name='seed_tfidf_v1',
            tokenizer='jieba',
            stopword_lang='chinese',
            vectorization='tfidf',
            normalize=True,
            dimensions=vectorizer.get_dimensions(),
            vocabulary_size=vectorizer.get_vocabulary_size()
        )
        db.session.add(vector_version)
        db.session.flush()
        
        print(f"向量化完成: 维度={vectorizer.get_dimensions()}, 词汇表={vectorizer.get_vocabulary_size()}")
        
        print("\n=== 执行示例查询 ===")
        retriever = VectorRetriever(metric='cosine')
        retriever.index(vectors, ids=doc_ids, contents=contents)
        
        test_queries = [
            "什么是深度学习",
            "Python 编程语言",
            "数据库查询语言",
            "云计算服务模式"
        ]
        
        for query_text in test_queries:
            query_vector = vectorizer.transform([query_text], normalize_vectors=True)[0]
            results = retriever.search(query_vector, top_k=3)
            
            query_record = QueryRecord(
                query_text=query_text,
                vector_version_id=vector_version.id,
                top_k=3
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
            
            print(f"\n查询: {query_text}")
            for result in results:
                print(f"  Rank {result['rank']}: 相似度={result['similarity_score']:.4f}")
        
        print("\n=== 添加示例标注 ===")
        for query_text in test_queries:
            query_record = QueryRecord.query.filter_by(query_text=query_text).first()
            if query_record:
                results = SimilarityResult.query.filter_by(query_record_id=query_record.id).order_by(SimilarityResult.rank).all()
                
                if results:
                    annotation = Annotation(
                        query_record_id=query_record.id,
                        corpus_id=results[0].corpus_id,
                        relevance=2 if query_text in ["什么是深度学习", "数据库查询语言"] else 3,
                        notes="示例标注"
                    )
                    db.session.add(annotation)
        
        db.session.commit()
        print("示例标注已添加")
        
        print("\n=== 种子数据填充完成 ===")
        print(f"文档总数: {Corpus.query.count()}")
        print(f"向量化版本数: {VectorVersion.query.count()}")
        print(f"查询记录数: {QueryRecord.query.count()}")
        print(f"标注记录数: {Annotation.query.count()}")

if __name__ == '__main__':
    seed_database()
