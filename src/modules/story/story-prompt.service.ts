import { Injectable } from '@nestjs/common';
import {
  AgeGroup,
  StoryDuration,
  StoryTheme,
} from '@prisma/client';

@Injectable()
export class StoryPromptService {
  buildSystemPrompt(params: { ageGroup: AgeGroup; language: string }): string {
    return [
      `You are a children's storyteller.`,
      `Write in language: ${params.language}.`,
      `Keep content safe, positive, and age-appropriate for ${params.ageGroup}.`,
      `Make it suitable for reading aloud (natural rhythm).`,
    ].join('\n');
  }

  buildUserPrompt(params: {
    theme?: StoryTheme;
    ageGroup: AgeGroup;
    duration: StoryDuration;
    templatePrompt?: string;
    customPrompt?: string;
  }): string {
    const targetWords =
      params.duration === StoryDuration.SHORT
        ? '300-500'
        : params.duration === StoryDuration.LONG
          ? '800-1100'
          : '500-800';

    return [
      params.theme ? `Theme: ${params.theme}` : '',
      `Age group: ${params.ageGroup}`,
      `Length (words): ${targetWords}`,
      params.templatePrompt
        ? `Template instructions:\n${params.templatePrompt}`
        : '',
      params.customPrompt ? `Extra instructions: ${params.customPrompt}` : '',
      `Output JSON with keys: title, content, characterNames(array).`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
