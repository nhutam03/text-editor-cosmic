import { Button, Flex, Text } from '@chakra-ui/react';
import { Check, Moon } from 'lucide-react';
// import { Save, SpellCheck, Palette } from 'lucide-react';

interface ToolbarProps {
    onSpellCheck: () => void;
    onThemeChange: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onSpellCheck, onThemeChange }) => {
    return (
        <Flex
            bg="gray.800"
            p={2}
            borderBottom="1px"
            borderColor="gray.700"
            h="40px"
            alignItems="center"
            justifyContent="space-between"
        >
            <Text fontSize="sm" fontWeight="bold">
                Cosmic Text Editor
            </Text>
            <Flex>
                <Button
                    aria-label="Spell Check"
                    variant="ghost"
                    colorScheme="gray"
                    mr={2}
                    onClick={onSpellCheck}
                >
                    <Check size={20} />
                </Button>
                <Button
                    aria-label="Toggle Theme"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={onThemeChange}
                >
                    <Moon size={20} />
                </Button>
            </Flex>
        </Flex>
    );
};

export default Toolbar;

// interface ToolbarProps {
//     onSave?: () => void;
//     onSpellCheck?: () => void;
//     onThemeChange?: () => void;
// }

// export default function Toolbar({ onSave, onSpellCheck, onThemeChange }: ToolbarProps) {
//     return (
//         <HStack p={2} borderBottom="1px" borderColor="gray.200" bg="gray.50" >
//             <Button size="sm" variant="outline" onClick={onSave} >
//                 Save
//             </Button>
//             <Button
//                 size="sm"
//                 variant="outline"
//                 onClick={onSpellCheck}
//             >
//                 Spell Check
//             </Button>
//             <Button
//                 size="sm"
//                 variant="outline"
//                 onClick={onThemeChange}
//             >
//                 Theme
//             </Button>
//         </HStack>
//     );
// }