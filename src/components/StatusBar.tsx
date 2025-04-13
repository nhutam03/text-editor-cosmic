import React from 'react';
import { Bell, Check, AlertTriangle } from 'lucide-react';

interface StatusBarProps {
    stats: {
        line: number;
        column: number;
        wordCount: number;
        page: number;
        language: string;
    };
}

const StatusBar: React.FC<StatusBarProps> = ({ stats }) => {
    return (
        <div className="flex bg-[#007acc] text-white text-xs h-[22px] items-center justify-between px-2">
            <div className="flex items-center space-x-2">
                <span className="flex items-center"><Bell size={12} className="mr-1" /> 0</span>
                <span className="flex items-center"><AlertTriangle size={12} className="mr-1" /> 0</span>
                <span className="flex items-center"><Check size={12} className="mr-1" /> 0</span>
            </div>
            <div className="flex items-center space-x-4">
                <span>Ln {stats.line}, Col {stats.column}</span>
                <span>Spaces: 2</span>
                <span>UTF-8</span>
                <span>CRLF</span>
                <span>{stats.language === 'typescript' ? 'TypeScript JSX' : stats.language}</span>
            </div>
        </div>
    );
};

export default StatusBar;