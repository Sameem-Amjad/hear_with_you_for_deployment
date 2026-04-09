export const SWAGGER_META = {
  DOCS: {
    TITLE: 'HearWithYou API',
    DESCRIPTION: 'Backend API for HearWithYou (auth, users, and more)',
    VERSION: '1.0',
  },
  TAGS: {
    AUTH: 'Auth',
    USER: 'User',
    ACTIVITY: 'Activity',
    VOICE_PROFILE: 'VoiceProfile',
    STORY: 'Story',
  },
  AUTH: {
    SOCIAL_LOGIN: {
      SUMMARY: 'Login or sign up with a Firebase social token',
      DESCRIPTION:
        'Validates the Firebase ID token and returns a custom token.',
    },
    EMAIL_REGISTER: {
      SUMMARY: 'Send registration OTP to email',
      DESCRIPTION: 'Creates an OTP record and emails it to the user.',
    },
    EMAIL_VERIFY_REGISTER: {
      SUMMARY: 'Verify email OTP and complete registration',
      DESCRIPTION:
        'Verifies OTP, creates Firebase user + DB user, then returns a custom token.',
    },
    PASSWORD_FORGOT: {
      SUMMARY: 'Send forgot password OTP',
      DESCRIPTION: 'Sends an OTP to email for password reset verification.',
    },
    PASSWORD_VERIFY_OTP: {
      SUMMARY: 'Verify forgot password OTP',
      DESCRIPTION: 'Verifies OTP validity before password reset.',
    },
    PASSWORD_RESET: {
      SUMMARY: 'Reset password using a valid OTP',
      DESCRIPTION:
        'Resets password in DB and updates Firebase password for the user.',
    },
    RESEND_OTP: {
      SUMMARY: 'Resend an OTP',
      DESCRIPTION: 'Resends an OTP for either email/phone and registration/forgot_password.',
    },
    PHONE_REGISTER: {
      SUMMARY: 'Send registration OTP to phone',
      DESCRIPTION: 'Creates an OTP record and sends it via SMS.',
    },
    PHONE_VERIFY_REGISTER: {
      SUMMARY: 'Verify phone OTP and complete registration',
      DESCRIPTION:
        'Verifies OTP, creates Firebase user + DB user, then returns a custom token.',
    },
    PASSWORD_LOGIN: {
      SUMMARY: 'Login with email or phone and password',
      DESCRIPTION:
        'Validates password and returns a Firebase custom token for session sign-in.',
    },
    LOGOUT: {
      SUMMARY: 'Logout current user',
      DESCRIPTION: 'Logs a logout activity event.',
    },
  },
  ACTIVITY: {
    GET_HISTORY: {
      SUMMARY: 'Get paginated user activity history',
      DESCRIPTION:
        'Returns user activity history with standard pagination meta.',
    },
  },
  USER: {
    SETUP_PROFILE: {
      SUMMARY: 'Setup user profile',
      DESCRIPTION:
        'Sets username/name and optionally uploads a profile picture (multipart/form-data).',
    },
    GET_PROFILE: {
      SUMMARY: 'Get current user profile',
      DESCRIPTION: 'Returns the current authenticated user profile.',
    },
    UPDATE_PROFILE: {
      SUMMARY: 'Update current user profile',
      DESCRIPTION:
        'Updates username/name and optionally replaces profile picture (multipart/form-data).',
    },
  },
  VOICE_PROFILE: {
    CREATE: {
      SUMMARY: 'Create voice profile (clone voice)',
      DESCRIPTION:
        'Uploads sample audio files, creates a voice profile, and clones via ElevenLabs.',
    },
    LIST: {
      SUMMARY: 'List voice profiles',
      DESCRIPTION: 'Returns active voice profiles for the current user.',
    },
  },
  STORY: {
    GENERATE: {
      SUMMARY: 'Generate a story with OpenAI',
      DESCRIPTION:
        'Generates a personalized story and saves it to the database (text-only).',
    },
    GET_ONE: {
      SUMMARY: 'Get a story',
      DESCRIPTION: 'Fetch a single story by id (must belong to user).',
    },
    LIST: {
      SUMMARY: 'List stories',
      DESCRIPTION: 'List user stories (paginated).',
    },
  },
} as const;
