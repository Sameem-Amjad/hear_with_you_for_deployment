import { Injectable } from '@nestjs/common';
import {
  AgeGroup,
  ChildProfile,
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
    child?: ChildProfile | null;
    templatePrompt?: string;
    customPrompt?: string;
  }): string {
    const targetWords =
      params.duration === StoryDuration.SHORT
        ? '300-500'
        : params.duration === StoryDuration.LONG
          ? '800-1100'
          : '500-800';

    const childBits: string[] = [];
    if (params.child) {
      childBits.push(`Child name: ${params.child.name}`);
      if (params.child.nickname)
        childBits.push(`Nickname: ${params.child.nickname}`);
      if (params.child.interests?.length)
        childBits.push(`Interests: ${params.child.interests.join(', ')}`);
      if (params.child.favoriteColors?.length)
        childBits.push(
          `Favorite colors: ${params.child.favoriteColors.join(', ')}`,
        );
      if (params.child.favoriteCharacters?.length)
        childBits.push(
          `Favorite characters: ${params.child.favoriteCharacters.join(', ')}`,
        );
    }

    return [
      params.theme ? `Theme: ${params.theme}` : '',
      `Age group: ${params.ageGroup}`,
      `Length (words): ${targetWords}`,
      params.templatePrompt
        ? `Template instructions:\n${params.templatePrompt}`
        : '',
      ...(childBits.length ? ['Personalization:', ...childBits] : []),
      params.customPrompt ? `Extra instructions: ${params.customPrompt}` : '',
      `Output JSON with keys: title, content, characterNames(array).`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
