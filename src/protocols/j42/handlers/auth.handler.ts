/**
 * Authentication handler for J42/JT808 protocol
 * Handles terminal authentication (0x0102)
 */

/**
 * Parse authentication request from terminal
 */
export function parseAuthRequest(bodyHex: string): any {
  try {
    const authCode = Buffer.from(bodyHex, "hex").toString("ascii");
    return {
      authCode,
      isValid: authCode.length > 0,
    };
  } catch (error: any) {
    return {
      authCode: bodyHex,
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * Create authentication response
 */
export function createAuthResponse(
  deviceId: string,
  sequence: number,
  result: number = 0,
): any {
  return {
    messageId: 0x8001,
    deviceId,
    sequence,
    result, // 0 = success, 1 = failure
    resultDescription:
      result === 0 ? "Authentication Successful" : "Authentication Failed",
  };
}
