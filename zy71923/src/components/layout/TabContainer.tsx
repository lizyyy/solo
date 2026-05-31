import type { ReactNode } from 'react';

interface TabContainerProps {
  children: ReactNode;
}

export default function TabContainer({ children }: TabContainerProps) {
  return (
    <main className="pt-20 pb-12 px-6 max-w-7xl mx-auto">
      <div className="animate-fadeIn">
        {children}
      </div>
    </main>
  );
}
