import React from 'react';

export default function BadComponent() {
  return (
    <div className="bad-component">
      <h2>这个 React 组件也有可访问性问题</h2>
      
      <img src="avatar.jpg" />
      
      <img src="icon.png" alt="" />
      
      <button className="icon-button">
        <span className="icon">⚙️</span>
      </button>
      
      <button role="button" aria-label="">
        空 aria-label
      </button>
      
      <form>
        <input 
          type="text" 
          id="input" 
          placeholder="用户名" 
        />
        
        <input 
          type="password" 
          id="input" 
          placeholder="密码"
        />
        
        <input 
          type="email" 
          placeholder="邮箱"
        />
      </form>
      
      <a href="/more">点击这里</a>
      
      <a href="/help">
        <span>❓</span>
      </a>
      
      <div id="card">第一个卡片</div>
      <div id="card">第二个卡片</div>
      
      <div>
        <input type="text" placeholder="第一个" tabindex="3" />
        <input type="text" placeholder="第二个" tabindex="1" />
        <input type="text" placeholder="第三个" tabindex="2" />
      </div>
      
      <a href="/link" tabindex="-1">
        这个链接无法用 Tab 聚焦
      </a>
      
      <button tabindex="-1">
        这个按钮也无法用 Tab 聚焦
      </button>
    </div>
  );
}
