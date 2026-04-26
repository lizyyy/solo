import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Book, ChevronRight, X, Tag, Lightbulb, ArrowRight } from 'lucide-react';
import { Header } from '../components/Layout';
import { searchTerms, getAllCategories, getTermsByCategory } from '../data/terms';
import { useApp } from '../context/AppContext';
import { Term } from '../types';

export const DictionaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isPositionSelected } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);

  useEffect(() => {
    if (!isPositionSelected) {
      navigate('/');
    }
  }, [isPositionSelected, navigate]);

  const categories = getAllCategories();

  const filteredTerms = useMemo(() => {
    if (searchQuery.trim()) {
      return searchTerms(searchQuery);
    }
    if (selectedCategory) {
      return getTermsByCategory(selectedCategory);
    }
    return [];
  }, [searchQuery, selectedCategory]);

  const TermDetailModal: React.FC = () => {
    if (!selectedTerm) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-dark text-lg">{selectedTerm.term}</h3>
                <span className="tag tag-primary text-xs flex-shrink-0">{selectedTerm.category}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedTerm(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-6">
              <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                <Book className="w-4 h-4 text-primary" />
                定义
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedTerm.definition}</p>
            </div>

            {selectedTerm.examples.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-accent" />
                  示例
                </h4>
                <div className="space-y-2">
                  {selectedTerm.examples.map((example, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-lg border-l-4 border-accent"
                    >
                      <p className="text-sm text-gray-600">"{example}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTerm.relatedTerms.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  相关术语
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTerm.relatedTerms.map((term, index) => (
                    <span
                      key={index}
                      className="tag tag-gray text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 mb-6">
              <h4 className="font-medium text-primary text-sm mb-1">💡 学习提示</h4>
              <p className="text-sm text-gray-600">
                理解专业术语是入门运营的第一步。遇到不懂的术语就来这里查，看多了自然就记住了。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TermCard: React.FC<{ term: Term }> = ({ term }) => (
    <div
      className="card mb-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
      onClick={() => setSelectedTerm(term)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-dark">{term.term}</h4>
            <span className="tag tag-gray text-xs">{term.category}</span>
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">{term.definition}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="运营术语词典"
        subtitle="快速理解专业术语，告别一脸懵"
      />

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedCategory(null);
            }}
            placeholder="搜索术语，如 SKU、UV、转化率..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {!searchQuery && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">按分类浏览</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === category ? null : category);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/30'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {searchQuery || selectedCategory ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                {searchQuery ? `搜索 "${searchQuery}"` : selectedCategory}
                <span className="ml-2 text-primary">{filteredTerms.length} 个结果</span>
              </p>
            </div>

            {filteredTerms.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 mb-2">未找到相关术语</p>
                <p className="text-sm text-gray-400">试试其他关键词</p>
              </div>
            ) : (
              <div>
                {filteredTerms.map((term) => (
                  <TermCard key={term.id} term={term} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">🔥 热门术语</h3>
              <div className="grid grid-cols-2 gap-2">
                {['UV', 'PV', '转化率', '客单价', 'GMV', '点击率'].map((termText) => {
                  const term = searchTerms(termText)[0];
                  if (!term) return null;
                  return (
                    <div
                      key={term.id}
                      className="card p-3 cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedTerm(term)}
                    >
                      <h4 className="font-medium text-dark">{term.term}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{term.definition}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Book className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-dark mb-1">如何高效使用词典？</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 遇到不懂的术语，马上搜索</li>
                    <li>• 关注示例，理解实际用法</li>
                    <li>• 结合相关术语，建立知识网络</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedTerm && <TermDetailModal />}
    </div>
  );
};
