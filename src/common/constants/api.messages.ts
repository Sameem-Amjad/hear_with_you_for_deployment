export const API_MESSAGES = {
  COMMON: {
    SUCCESS: {
      DEFAULT: 'Request successful',
    },
  },
  AUTH: {
    SUCCESS: {
      SOCIAL_LOGIN_EXISTING: 'Social login successful',
      SOCIAL_LOGIN_NEW: 'Social account created successfully',
      OTP_SENT_EMAIL: 'OTP sent to email',
      OTP_SENT_PHONE: 'OTP sent to phone',
      OTP_VERIFIED: 'OTP verified',
      REGISTRATION_SUCCESS: 'Registration successful',
      LOGIN_SUCCESS: 'Login successful',
      LOGOUT_SUCCESS: 'Logged out successfully',
      PASSWORD_RESET_SUCCESS: 'Password reset successful',
    },
    ERROR: {
      INVALID_CREDENTIALS: 'Invalid credentials',
      EMAIL_NOT_FOUND: 'Email not found',
      USER_NOT_FOUND: 'User not found',
      EMAIL_ALREADY_REGISTERED: 'Email is already registered',
      PHONE_ALREADY_REGISTERED: 'Phone is already registered',
      PASSWORD_RESET_EMAIL_ONLY:
        'Password reset is only available for email accounts',
    },
  },
  USER: {
    SUCCESS: {
      PROFILE_SETUP: 'Profile setup successful',
      PROFILE_UPDATED: 'Profile updated successfully',
    },
    ERROR: {
      USERNAME_TAKEN: 'Username is already taken',
      USER_NOT_FOUND: 'User not found',
    },
  },
  STORY: {
    SUCCESS: {
      GENERATED: 'Story generated successfully',
    },
    ERROR: {
      LIMIT_REACHED: 'Monthly story limit reached for your subscription plan',
    },
  },
} as const;
