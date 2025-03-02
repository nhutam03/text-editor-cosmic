import { Flex, 
    // HStack, 
    Text } from '@chakra-ui/react';

// interface StatusBarProps {
//     stats: { 
//         words: number; 
//         chars: number; 
//         lines: number };
// }
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
        <Flex
            bg="gray.800"
            p={2}
            borderTop="1px"
            borderColor="gray.700"
            h="30px"
            alignItems="center"
            justifyContent="space-between"
        >
            <Text fontSize="xs">
                Ln {stats.line}, Col {stats.column} | Words: {stats.wordCount} | Pages: {stats.page} | Lang: {stats.language}
            </Text>
            <Text fontSize="xs">Status: Ready</Text>
        </Flex>
    );
};

export default StatusBar;

// export default function StatusBar({ stats = { words: 0, chars: 0, lines: 0 } }: StatusBarProps) {
//     return (
//         <HStack p={2} borderTop="1px" borderColor="gray.200" bg="gray.50" justify="space-between">
//             <Text fontSize="sm">Words: {stats.words}</Text>
//             <Text fontSize="sm">Chars: {stats.chars}</Text>
//             <Text fontSize="sm">Lines: {stats.lines}</Text>
//         </HStack>
//     );
// }