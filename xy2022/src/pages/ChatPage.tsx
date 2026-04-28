import { useState } from 'react';
import { Header } from '../components/UI';

const ChatPage = () => {

  const [messages, setMessages] = useState<
    { text: string; isUser: boolean; time: string }[]
  >([
    {
      text: '您好！我是宠喂上门的智能客服小宠，请问有什么可以帮您的？',
      isUser: false,
      time: '刚刚',
    },
  ]);
  const [inputText, setInputText] = useState('');

  const quickQuestions = [
    '如何预约服务？',
    '如何取消订单？',
    '退款流程是怎样的？',
    '喂养师的资质如何？',
  ];

  const formatTime = () => {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage = {
      text: inputText,
      isUser: true,
      time: formatTime(),
    };

    setMessages([...messages, userMessage]);
    setInputText('');

    setTimeout(() => {
      const replies: Record<string, string> = {
        '如何预约服务？':
          '您可以通过首页的服务入口选择需要的服务类型，然后按照提示填写地址、时间、狗狗信息等，最后确认下单即可。',
        '如何取消订单？':
          '待付款/待接单状态的订单可以直接在订单详情页点击"取消订单"按钮。进行中的订单请联系客服处理。',
        '退款流程是怎样的？':
          '订单取消后，退款将在1-3个工作日内原路返回。使用优惠券支付的部分不予退还。',
        '喂养师的资质如何？':
          '我们的喂养师都经过严格筛选和培训，持有相关宠物护理证书，并购买了专业保险。',
      };

      const reply =
        replies[inputText] ||
        '感谢您的咨询！如果您有其他问题，可以继续提问，或拨打客服热线 400-123-4567。';

      const botMessage = {
        text: reply,
        isUser: false,
        time: formatTime(),
      };

      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <div
      className="page-container"
      style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column' }}
    >
      <Header title="在线客服" />

      <div className="text-center py-3 bg-gray">
        <p className="text-xs text-secondary">
          客服工作时间：9:00 - 21:00
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className="flex mb-4"
            style={{ justifyContent: msg.isUser ? 'flex-end' : 'flex-start' }}
          >
            {!msg.isUser && (
              <div
                className="avatar avatar-sm"
                style={{
                  marginRight: 10,
                  background: '#FF6B35',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 14,
                }}
              >
                宠
              </div>
            )}
            <div
              className="p-3 rounded-lg max-w-80"
              style={{
                background: msg.isUser ? '#FF6B35' : '#F2F2F7',
                color: msg.isUser ? 'white' : '#1D1D1F',
              }}
            >
              <p className="text-sm">{msg.text}</p>
              <p
                className="text-xs mt-1"
                style={{ color: msg.isUser ? 'rgba(255,255,255,0.7)' : '#AEAEB2' }}
              >
                {msg.time}
              </p>
            </div>
            {msg.isUser && (
              <div
                className="avatar avatar-sm"
                style={{
                  marginLeft: 10,
                  background: '#E5E5EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666',
                  fontSize: 14,
                }}
              >
                我
              </div>
            )}
          </div>
        ))}

        <div className="mt-4">
          <p className="text-xs text-secondary mb-2">常见问题</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, index) => (
              <span
                key={index}
                className="tag tag-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => handleQuickQuestion(q)}
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom-actions">
        <input
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #E5E5EA',
            borderRadius: 8,
            fontSize: 16,
          }}
          placeholder="输入消息..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '12px 24px' }}
          onClick={handleSend}
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
