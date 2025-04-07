import React, { forwardRef } from 'react';
import { Files, Search, Package, GitBranch, Bug, Puzzle } from 'lucide-react';
import { Button } from './ui/button';


interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onTabClick: (tab: string) => void;
}


// const Sidebar: React.FC<SidebarProps> = ({ setActiveTab }) => {
const Sidebar = forwardRef<HTMLDivElement, SidebarProps>((props, ref) => {
    const { activeTab, onTabClick } = props;
    return (
        <div
            ref={ref}
            className="w-[48px] bg-[#333333] flex flex-col items-center transition-all duration-300"
        >
            <div className="flex flex-col gap-4 mt-4">
                <Button
                    variant="ghost"
                    className={`w-full p-2 justify-center hover:bg-[#505050] ${activeTab === "explorer" ? "border-l-2 border-white bg-[#505050]" : ""}`}
                    onClick={() => onTabClick("explorer")}
                >
                    <Files size={24} />
                </Button>
                <Button
                    variant="ghost"
                    className={`w-full p-2 justify-center hover:bg-[#505050] ${activeTab === "search" ? "border-l-2 border-white bg-[#505050]" : ""}`}
                    onClick={() => onTabClick("search")}
                >
                    <Search size={24} />
                </Button>
                <Button
                    variant="ghost"
                    className={`w-full p-2 justify-center hover:bg-[#505050] ${activeTab === "source-control" ? "border-l-2 border-white bg-[#505050]" : ""}`}
                    onClick={() => onTabClick("source-control")}
                >
                    <GitBranch size={24} />
                </Button>
                <Button
                    variant="ghost"
                    className={`w-full p-2 justify-center hover:bg-[#505050] ${activeTab === "debug" ? "border-l-2 border-white bg-[#505050]" : ""}`}
                    onClick={() => onTabClick("debug")}
                >
                    <Bug size={24} />
                </Button>
                <Button
                    variant="ghost"
                    className={`w-full p-2 justify-center hover:bg-[#505050] ${activeTab === "extensions" ? "border-l-2 border-white bg-[#505050]" : ""}`}
                    onClick={() => onTabClick("extensions")}
                >
                    <Puzzle size={24} />
                </Button>
            </div>
        </div>
    );
});

export default Sidebar;
