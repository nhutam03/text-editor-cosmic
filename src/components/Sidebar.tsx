import { VStack, Box, Button, 
} from '@chakra-ui/react';
import React, { forwardRef } from 'react';
import { Home, 
    // ListCheck, 
    ListChecks, Package } from 'lucide-react';
//import { recentFiles } from '../plugins/recentFiles';

interface SidebarProps {
    // activeTab: string;
    setActiveTab: (tab: string) => void;
    // onTabClick: (tab: string) => void;
}


const Sidebar: React.FC<SidebarProps> = ({ setActiveTab }) => {
    return (
        <Box
            w="45px"
            bg="#272B2F"
            display="flex"
            flexDir="column"
            alignItems="center"
            transition="all 0.3s"
        >
            <VStack gap={3} mt={2}>
                <Button
                    variant="ghost"
                    p={2}
                    w="full"
                    justifyContent="center"
                    _hover={{ bg: 'gray.700' }}
                    rounded="md"
                    onClick={() => setActiveTab('explorer')}
                >
                    <Home size={20} />
                </Button>
                <Button
                    variant="ghost"
                    p={2}
                    w="full"
                    justifyContent="center"
                    _hover={{ bg: 'gray.700' }}
                    rounded="md"
                    onClick={() => setActiveTab('search')}
                >
                    <ListChecks size={20} />
                </Button>
                <Button
                    variant="ghost"
                    p={2}
                    w="full"
                    justifyContent="center"
                    _hover={{ bg: 'gray.700' }}
                    rounded="md"
                    onClick={() => setActiveTab('extensions')}
                >
                    <Package size={20} />
                </Button>
            </VStack>
        </Box>
    );
};

export default Sidebar;
