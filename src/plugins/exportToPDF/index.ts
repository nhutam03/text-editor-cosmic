// src/main/plugins/pdf-export/index.ts
import PdfGenerator from "./pdfGenerator";

const plugin = {
    name: "pdf-export",
    execute: async (content: string, outputPath: string): Promise<string> => {
        return await PdfGenerator.generate(content, outputPath);
    },
};

export default plugin;