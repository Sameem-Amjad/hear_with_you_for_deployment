import { Injectable } from '@nestjs/common';

@Injectable()
export class AudioProcessorService {
  chunkText(text: string, maxChars = 5000): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= maxChars) return [normalized];

    const parts: string[] = [];
    let current = '';
    for (const paragraph of normalized.split('\n\n')) {
      const p = paragraph.trim();
      if (!p) continue;
      if ((current + '\n\n' + p).trim().length <= maxChars) {
        current = current ? `${current}\n\n${p}` : p;
        continue;
      }
      if (current) parts.push(current);
      if (p.length <= maxChars) {
        current = p;
      } else {
        // hard split long paragraph
        for (let i = 0; i < p.length; i += maxChars) {
          parts.push(p.slice(i, i + maxChars));
        }
        current = '';
      }
    }
    if (current) parts.push(current);
    return parts;
  }
}
