import React from 'react';
import { useTranslation } from 'react-i18next';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <header>
      <nav>
        <ul>
          <li>{t('page.home')}</li>
          <li>{t('page.about')}</li>
          <li>联系我们</li>
          <li>个人中心</li>
        </ul>
      </nav>
      <div className="user-info">
        <span>{t('common.greeting', { name: '张三' })}</span>
        <button>{t('user.logout')}</button>
      </div>
    </header>
  );
};
