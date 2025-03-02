import React from 'react';
import { Box, Text } from '@chakra-ui/react';

interface ContentAreaProps {
    width: number;
    activeTab: string;
}

const ContentArea: React.FC<ContentAreaProps> = ({ width, activeTab }) => {
    const renderContent = () => {
        switch (activeTab) {
            case 'explorer':
                return (
                    <Box p={2}>
                        <Text>Explorer</Text>
                        <Box mt={2}>
                            <Text>NO FOLDER OPENED</Text>
                        </Box>
                    </Box>
                );
            case 'search':
                return <Box p={2}><Text>Search Content</Text></Box>;
            case 'extensions':
                return <Box p={2}><Text>Extensions Content</Text></Box>;
            default:
                return null;
        }
    };

    return (
        <Box
            w={`${width}px`}
            bg="#191B1C"
            transition="all 0.3s"
            overflowY={width === 0 ? 'hidden' : 'auto'}
            p={width === 0 ? 0 : 2}
            h="100%"
        >
            {renderContent()}
        </Box>
    );
};

export default ContentArea;

// interface ContentAreaProps {
//     width: number;
//     activeTab: string;
// }

// const ContentArea: React.FC<ContentAreaProps> = ({ width, activeTab }) => {
//     const renderContent = () => {
//         switch (activeTab) {
//             case 'explorer':
//                 return (
//                     <Box p={2}>
//                         <Text>Explorer</Text>
//                         <Box mt={2}>
//                             <Text>NO FOLDER OPENED</Text>
//                         </Box>
//                     </Box>
//                 );
//             case 'search':
//                 return <Box p={2}><Text>Search Content</Text></Box>;
//             case 'extensions':
//                 return <Box p={2}><Text>Extensions Content</Text></Box>;
//             default:
//                 return null;
//         }
//     };

//     return (
//         <Box
//             w={`${width}px`} 
//             bg="#191B1C"
//             transition="all 0.3s"
//             overflowY="auto"
//             h="100%"
//         >
//             {renderContent()}
//         </Box>
//     );
// };

// export default ContentArea;