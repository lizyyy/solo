import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div>
          <h1>并发原语可视化实验台</h1>
          <p className="header-subtitle">
            可视化演示 mutex、读写锁、自旋锁、CAS、无锁队列和 ABA 问题
          </p>
        </div>
      </div>
    </header>
  );
};
