export const API_PATHS = {
  V1_PREFIX: 'api/v1',
  DOCS: 'api/docs',
  AUTH: {
    ROOT: 'auth',
    SOCIAL_LOGIN: 'sociallogin',
    EMAIL: {
      REGISTER: 'email/register',
      VERIFY_REGISTER: 'email/verifyregister',
      ResendRegister: 'email/resend-register',
      LOGIN: 'email/login',
    },
    PHONE: {
      REGISTER: 'phone/register',
      VERIFY_REGISTER: 'phone/verifyregister',
    },
    PASSWORD: {
      
      FORGOT: 'password/forgot',
      VERIFY_OTP: 'password/verifyotp',
      ResendOtp: 'password/resend-otp',
      RESET: 'password/reset',
    },
    FCM_TOKEN: 'fcm-token',
    LOGOUT: 'logout',
  },
  USER: {
    PROFILE_ROOT: 'user/profile',
    PROFILE_SETUP: 'setup',
  },
  ACTIVITY: {
    USER_HISTORY_ROOT: 'user/activityhistory',
  },
  VOICE_PROFILES: {
    ROOT: 'voice-profiles',
  },
  STORIES: {
    ROOT: 'stories',
    GENERATE: 'generate',
    STATUS: ':id/status',
  },
} as const;
