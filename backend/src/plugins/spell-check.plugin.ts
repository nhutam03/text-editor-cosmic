import { Injectable } from '@nestjs/common';

@Injectable()
export class SpellCheckService {
  checkSpelling(text: string): string[] {
    const misspelledWords = ['teh', 'recieve'];
    const words = text.split(/\s+/);
    return words.filter((word) => misspelledWords.includes(word));
  }
}
