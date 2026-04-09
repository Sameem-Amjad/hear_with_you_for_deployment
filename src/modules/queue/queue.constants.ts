export const QUEUE_NAMES = {
  STORY_GENERATION: 'story-generation',
  AUDIO_GENERATION: 'audio-generation',
  CLEANUP: 'cleanup',
} as const;

export const QUEUE_JOB_NAMES = {
  STORY_GENERATE_TEXT: 'generate-text',
  STORY_FULL_PIPELINE: 'full-pipeline',
  AUDIO_GENERATE: 'generate-audio',
  AUDIO_CHUNK: 'chunk-audio',
  CLEANUP_DELETE_OLD: 'delete-old-jobs',
  CLEANUP_TEMP_FILES: 'cleanup-temp-files',
} as const;
