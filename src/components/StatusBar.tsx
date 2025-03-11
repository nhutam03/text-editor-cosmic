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
        <div className="flex bg-gray-800 p-2 border-t border-gray-700 h-[30px] items-center justify-between">
            <span className="text-xs text-white">
                Ln {stats.line}, Col {stats.column} | Words: {stats.wordCount} | Pages:{" "}
                {stats.page} | Lang: {stats.language}
            </span>
            <span className="text-xs text-white">Status: Ready</span>
        </div>
    );
};

export default StatusBar;