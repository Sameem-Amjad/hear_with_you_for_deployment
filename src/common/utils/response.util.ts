export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

export function buildSuccessResponse<T>(
  statusCode: number,
  data: T,
  message = 'Request successful',
): StandardResponse<T> {
  return {
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}
