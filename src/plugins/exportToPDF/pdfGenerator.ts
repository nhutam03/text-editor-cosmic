// src/main/plugins/pdf-export/pdfGenerator.ts
import PDFDocument from "pdfkit";
import fs from "fs-extra";

class PdfGenerator {
    async generate(content: string, outputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(outputPath);

            doc.pipe(stream);
            doc.fontSize(12).text(content, 100, 100);
            doc.end();

            stream.on("finish", () => resolve(outputPath));
            stream.on("error", (err) => reject(err));
        });
    }
}

export default new PdfGenerator();