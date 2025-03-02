export function wordCount(text: string) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const lines = text.split('\n').length;
    return { words, chars, lines };
}