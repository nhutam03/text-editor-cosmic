import React, { ReactNode } from 'react';

interface ContextMenuProps {
  children: ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ children }) => {
  return <div className="relative">{children}</div>;
};

interface ContextMenuTriggerProps {
  children: ReactNode;
}

export const ContextMenuTrigger: React.FC<ContextMenuTriggerProps> = ({ children }) => {
  return <>{children}</>;
};

interface ContextMenuContentProps {
  children: ReactNode;
}

export const ContextMenuContent: React.FC<ContextMenuContentProps> = ({ children }) => {
  return (
    <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-[#3c3c3c] bg-[#252526] p-1 shadow-md animate-in fade-in-80 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1">
      {children}
    </div>
  );
};

interface ContextMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ children, onClick, disabled = false }) => {
  return (
    <div
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-[#2a2d2e] focus:text-white hover:bg-[#2a2d2e] hover:text-white ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const ContextMenuSeparator: React.FC = () => {
  return <div className="h-px my-1 bg-[#3c3c3c]" />;
};
