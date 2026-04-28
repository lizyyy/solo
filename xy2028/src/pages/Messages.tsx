import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Message, Reply } from '../types';

const Messages = () => {
  const { items, likeMessage, hasLikedMessage, addMessage, replyMessage } = useApp();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newMessageItem, setNewMessageItem] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [newMessageAuthor, setNewMessageAuthor] = useState('');
  const [filterItem, setFilterItem] = useState<string | null>(null);
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('');

  const getAllMessages = (): (Message & { itemEmoji: string })[] => {
    let messages: (Message & { itemEmoji: string })[] = [];
    items.forEach(item => {
      item.messages.forEach(msg => {
        messages.push({ ...msg, itemEmoji: item.emoji });
      });
    });
    return messages.sort((a, b) => b.timestamp - a.timestamp);
  };

  const filteredMessages = filterItem
    ? getAllMessages().filter(m => m.itemId === filterItem)
    : getAllMessages();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const handleSendMessage = () => {
    if (!newMessageItem || !newMessageContent.trim()) return;
    
    addMessage(newMessageItem, newMessageContent, newMessageAuthor);
    
    setNewMessageItem('');
    setNewMessageContent('');
    setNewMessageAuthor('');
    setShowCompose(false);
  };

  const handleSendReply = (itemId: string, messageId: string) => {
    if (!replyContent.trim()) return;
    
    replyMessage(itemId, messageId, replyContent, replyAuthor);
    
    setReplyContent('');
    setReplyAuthor('');
    setReplyingMessageId(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <span className="text-5xl block mb-3">💬</span>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">匿名造物树洞</h1>
        <p className="text-gray-500">在这里，每一件物品都有它的故事</p>
      </div>

      <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-6 border border-primary/10">
        <div className="flex items-start gap-4">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="font-bold text-gray-800 mb-1">关于树洞</h3>
            <p className="text-gray-600 text-sm">
              每一件被制造出来的物品，都承载着独特的意义。在这里，你可以匿名分享你与物品的故事，
              也可以浏览他人留下的温暖话语。所有的留言都是匿名的，让我们真诚地对话。
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterItem(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterItem === null
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {items.filter(item => item.messages.length > 0).map(item => (
            <button
              key={item.id}
              onClick={() => setFilterItem(item.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                filterItem === item.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowCompose(true)}
        className="w-full py-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-primary/5 transition-all text-gray-500 hover:text-primary font-medium"
      >
        <span className="text-xl mr-2">✏️</span>
        写一条寄语
      </button>

      {filteredMessages.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <span className="text-5xl block mb-4">📝</span>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {filterItem ? '这件物品还没有留言' : '还没有人留言'}
          </h3>
          <p className="text-gray-500 mb-4">来做第一个分享者吧！</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            浏览造物图鉴
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message, index) => (
            <div
              key={message.id}
              className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
                index === 0 ? 'ring-2 ring-primary/20' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-lg">
                    {message.author.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{message.author}</span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-warm/20 text-amber-700 rounded text-xs">
                          最新
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{message.itemEmoji} 关于 {message.itemName}</span>
                      <span>·</span>
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => likeMessage(message.itemId, message.id)}
                    disabled={hasLikedMessage(message.id)}
                    className={`p-2 rounded-full transition-colors ${
                      hasLikedMessage(message.id)
                        ? 'bg-red-50 text-red-500 cursor-default'
                        : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'
                    }`}
                  >
                    {hasLikedMessage(message.id) ? '❤️' : '🤍'}
                  </button>
                  <span className={`text-sm ${hasLikedMessage(message.id) ? 'text-red-500' : 'text-gray-400'}`}>
                    {message.likes}
                  </span>
                </div>
              </div>
              
              <div className="pl-13">
                <p className="text-gray-700 leading-relaxed">
                  "{message.content}"
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <Link
                    to={`/item/${message.itemId}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <span>{message.itemEmoji}</span>
                    <span>查看{message.itemName}</span>
                    <span>→</span>
                  </Link>
                  <button 
                    onClick={() => {
                      if (replyingMessageId === message.id) {
                        setReplyingMessageId(null);
                        setReplyContent('');
                        setReplyAuthor('');
                      } else {
                        setReplyingMessageId(message.id);
                        setReplyContent('');
                        setReplyAuthor('');
                      }
                    }}
                    className={`text-sm transition-colors ${
                      replyingMessageId === message.id 
                        ? 'text-primary' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    💬 回复
                  </button>
                </div>

                {message.replies && message.replies.length > 0 && (
                  <div className="pl-4 border-l-2 border-gray-200 space-y-3 mb-3">
                    {message.replies.map((reply: Reply) => (
                      <div key={reply.id} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-700">{reply.author}</span>
                          <span className="text-xs text-gray-400">{formatTime(reply.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyingMessageId === message.id && (
                  <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                    <input
                      type="text"
                      value={replyAuthor}
                      onChange={(e) => setReplyAuthor(e.target.value)}
                      placeholder="你的名字 (可选，默认匿名)"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="写下你的回复..."
                      rows={2}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendReply(message.itemId, message.id)}
                        disabled={!replyContent.trim()}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          replyContent.trim()
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        发送
                      </button>
                      <button
                        onClick={() => {
                          setReplyingMessageId(null);
                          setReplyContent('');
                          setReplyAuthor('');
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md animate-slide-up">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">写寄语</h2>
                <button
                  onClick={() => setShowCompose(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择物品
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setNewMessageItem(item.id)}
                      className={`p-3 rounded-xl text-center transition-all ${
                        newMessageItem === item.id
                          ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{item.emoji}</span>
                      <span className="text-xs">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  你的名字 <span className="text-gray-400">(可选，默认匿名)</span>
                </label>
                <input
                  type="text"
                  value={newMessageAuthor}
                  onChange={(e) => setNewMessageAuthor(e.target.value)}
                  placeholder="例如：匿名的小画家"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  你想说的话
                </label>
                <textarea
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  placeholder="分享你与这件物品的故事，或者写下一句治愈的话语..."
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">温馨提示</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500">
                      <li>所有留言都是匿名的，请放心分享</li>
                      <li>请使用友善、积极的语言</li>
                      <li>你的话语可能会温暖到某个人</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white p-6 border-t border-gray-100">
              <button
                onClick={handleSendMessage}
                disabled={!newMessageItem || !newMessageContent.trim()}
                className={`w-full py-4 rounded-xl font-bold transition-all btn-press ${
                  newMessageItem && newMessageContent.trim()
                    ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                发送寄语
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-warm/20 to-accent/20 rounded-2xl p-6 text-center">
        <span className="text-4xl block mb-3">🌟</span>
        <h3 className="font-bold text-gray-800 mb-2">每一件物品都有故事</h3>
        <p className="text-gray-600 text-sm mb-4">
          去探索更多物品的生产过程，了解它们背后的故事
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {items.slice(0, 6).map(item => (
            <Link
              key={item.id}
              to={`/item/${item.id}`}
              className="px-3 py-2 bg-white/80 backdrop-blur rounded-full text-sm hover:bg-white transition-colors shadow-sm"
            >
              {item.emoji} {item.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Messages;