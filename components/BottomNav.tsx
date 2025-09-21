
import React from 'react';
import { View } from '../types';
import { NAV_ITEMS } from '../constants';

interface BottomNavProps {
    activeView: View;
    setActiveView: (view: View) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
  const navItemsForBottomBar = NAV_ITEMS.filter(item => item.name !== 'Dashboard');

  return (
    <nav id="bottom-nav" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] theme-athlete:bg-slate-900 theme-athlete:border-slate-700">
      {navItemsForBottomBar.map((item) => (
        <button
          key={item.name}
          onClick={() => setActiveView(item.name)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-2
            transition-colors duration-200
            ${
              activeView === item.name
                ? 'text-brand-green'
                : 'text-slate-500 hover:text-brand-green'
            }
          `}
          aria-label={item.name}
        >
          {React.cloneElement(item.icon, { className: 'w-6 h-6' })}
          <span className="text-xs truncate">{item.name}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
