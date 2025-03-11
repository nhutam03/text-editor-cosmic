import { Check, Moon } from 'lucide-react';
import { Button } from './ui/button';
// import { Save, SpellCheck, Palette } from 'lucide-react';

interface ToolbarProps {
    onSpellCheck: () => void;
    onThemeChange: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onSpellCheck, onThemeChange }) => {
    return (
        <div className="flex bg-gray-800 p-2 border-b border-gray-700 h-[40px] items-center justify-between">
            <div className="flex">
                <Button
                    aria-label="Spell Check"
                    className="mr-2 p-2 bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white rounded-md"
                    onClick={onSpellCheck}
                >
                    <Check size={20} />
                </Button>
                <Button
                    aria-label="Toggle Theme"
                    className="p-2 bg-transparent hover:bg-gray-700 text-gray-300 hover:text-white rounded-md"
                    onClick={onThemeChange}
                >
                    <Moon size={20} />
                </Button>
            </div>
        </div>
    );
};

export default Toolbar;