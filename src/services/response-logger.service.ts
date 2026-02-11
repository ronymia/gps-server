/**
 * Response Logger Service
 * Tracks all server responses (ACKs, registration responses, etc.) sent to devices
 */

import { FastifyBaseLogger } from "fastify";
import dayjs from "dayjs";

export interface ResponseLogEntry {
  deviceId: string;
  messageType: string;
  responseHex: string;
  requestHex: string;
  timestamp: string;
}

export class ResponseLoggerService {
  private responses: ResponseLogEntry[] = [];
  private readonly MAX_RESPONSES = 1000;
  private seenResponseData: Set<string> = new Set();
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Log a server response (with duplicate detection)
   */
  logServerResponse(
    deviceId: string,
    messageTypeDescription: string,
    responseHex: string,
    requestHex: string,
  ): ResponseLogEntry {
    // Check for duplicate response
    const responseKey = `${deviceId}-${responseHex}`;
    if (this.seenResponseData.has(responseKey)) {
      if (this.logger) {
        this.logger.info(
          `🔄 DUPLICATE response detected (not logging): ${messageTypeDescription} for ${deviceId}`,
        );
      }
      // Still return the entry but don't store it
      return {
        deviceId,
        messageType: messageTypeDescription,
        responseHex,
        requestHex,
        timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };
    }

    // Add to seen set
    this.seenResponseData.add(responseKey);

    // Limit seen set size
    if (this.seenResponseData.size > 5000) {
      const arr = Array.from(this.seenResponseData);
      this.seenResponseData = new Set(arr.slice(1000));
    }

    const logEntry: ResponseLogEntry = {
      deviceId,
      messageType: messageTypeDescription,
      responseHex,
      requestHex,
      timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    this.responses.unshift(logEntry);
    if (this.responses.length > this.MAX_RESPONSES) {
      this.responses.pop();
    }

    return logEntry;
  }

  /**
   * Get recent server responses
   */
  getServerResponses(limit: number = 10): ResponseLogEntry[] {
    return this.responses.slice(0, limit);
  }

  /**
   * Get responses for a specific device
   */
  getDeviceResponses(deviceId: string, limit: number = 10): ResponseLogEntry[] {
    return this.responses
      .filter((r) => r.deviceId === deviceId)
      .slice(0, limit);
  }

  /**
   * Clear all responses
   */
  clear(): void {
    this.responses = [];
  }

  /**
   * Get total response count
   */
  getCount(): number {
    return this.responses.length;
  }
}
