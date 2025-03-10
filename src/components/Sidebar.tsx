import React, { forwardRef } from 'react';
import { Home, ListChecks, Package } from 'lucide-react';
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
            className="w-[45px] bg-[#272B2F] flex flex-col items-center transition-all duration-300"
        >
            <div className="flex flex-col gap-3 mt-2">
                <Button
                    variant="ghost"
                    className="w-full p-2 justify-center hover:bg-gray-700 rounded-md"
                    onClick={() => onTabClick("explorer")}
                >
                    <Home size={20} />
                </Button>
                <Button
                    variant="ghost"
                    className="w-full p-2 justify-center hover:bg-gray-700 rounded-md"
                    onClick={() => onTabClick("search")}
                >
                    <ListChecks size={20} />
                </Button>
                <Button
                    variant="ghost"
                    className="w-full p-2 justify-center hover:bg-gray-700 rounded-md"
                    onClick={() => onTabClick("extensions")}
                >
                    <Package size={20} />
                </Button>
            </div>
        </div>
    );
});

export default Sidebar;
