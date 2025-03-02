import React, { useEffect, useRef, useState} from 'react';
import Editor from '@monaco-editor/react';
// import { editor } from 'monaco-editor';
// import { spellCheck } from '../plugins/spellCheck';
// import { wordCount } from '../plugins/wordCount';
import { Box, Button, Flex, Text } from '@chakra-ui/react';


interface EditorProps {
    onContentChange: (stats: { line: number; column: number; wordCount: number }) => void;
}
const EditorComponent: React.FC<EditorProps> = ({ onContentChange }) => {
    const [openFiles, setOpenFiles] = useState<string[]>(['File1.txt']);
    const [activeFile, setActiveFile] = useState('File1.txt');

    const handleEditorChange = (value: string | undefined) => {
        if (value) {
            const lines = value.split('\n');
            const line = lines.length;
            const words = value.trim().split(/\s+/).filter(Boolean).length;
            const column = value.split('\n').pop()?.length || 1;
            onContentChange({ line, column, wordCount: words });
        }
    };

    const handleFileClick = (file: string) => {
        setActiveFile(file);
    };

    const handleCloseFile = (file: string) => {
        setOpenFiles(openFiles.filter(f => f !== file));
        if (activeFile === file && openFiles.length > 1) {
            setActiveFile(openFiles[0]);
        }
    };

    return (
        <Flex flex={1} flexDir="column" bg="gray.900">
            {/* Open Files Bar */}
            <Flex
                bg="gray.800"
                p={2}
                borderBottom="1px"
                borderColor="gray.700"
                h="30px"
                alignItems="center"
                overflowX="auto"
            >
                {openFiles.map((file) => (
                    <Flex
                        key={file}
                        bg={activeFile === file ? 'gray.700' : 'gray.800'}
                        p={1}
                        px={2}
                        mr={2}
                        borderRadius={4}
                        alignItems="center"
                        cursor="pointer"
                        onClick={() => handleFileClick(file)}
                    >
                        <Text fontSize="xs">{file}</Text>
                        <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            ml={1}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file);
                            }}
                        >
                            ×
                        </Button>
                    </Flex>
                ))}
            </Flex>

            {/* Monaco Editor */}
            <Box flex={1}>
                <Editor
                    height="100%"
                    defaultLanguage="plaintext"
                    defaultValue="// Start coding here"
                    theme="vs-dark"
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                    }}
                />
            </Box>
        </Flex>
    );
};

export default EditorComponent;
