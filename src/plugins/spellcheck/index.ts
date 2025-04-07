import NSpell from "nspell";
import { readFile } from "fs/promises";
import path from "path";

export class SpellChecker {
  private checker: NSpell | null = null;

  async initialize(language: string = "en"): Promise<void> {
    try {
      const affPath = path.join(__dirname, `checks/index_${language}.aff`);
      const dicPath = path.join(__dirname, `checks/index_${language}.dic`);

      const [aff, dic] = await Promise.all([
        readFile(affPath),
        readFile(dicPath),
      ]);

      this.checker = new NSpell(aff, dic);
    } catch (err) {
      console.error("Failed to initialize spell checker:", err);
      throw err;
    }
  }

  check(word: string): boolean {
    if (!this.checker) throw new Error("Spell checker not initialized");
    return this.checker.correct(word);
  }

  suggest(word: string): string[] {
    if (!this.checker) throw new Error("Spell checker not initialized");
    return this.checker.suggest(word);
  }
}
export default {
  name: "spell-check",
  execute: async (content: string): Promise<any> => {
    const spellChecker = new SpellChecker();
    await spellChecker.initialize();
    const words = content.split(/\s+/);
    const errors = words
      .filter((word) => !spellChecker.check(word))
      .map((word) => ({
        word,
        suggestions: spellChecker.suggest(word),
      }));
    return errors;
  },
};
