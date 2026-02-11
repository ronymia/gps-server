/**
 * Core parsing utilities for J42/JT808 protocol
 */

import dayjs from "dayjs";

/**
 * Parse BCD time components individually
 * Each byte contains two BCD digits
 * Example: 0x25 = binary 0010 0101 = decimal 25
 */
export function parseBCDTimeComponents(hex: string): any {
  const result: any = {};
  try {
    // Each byte contains two BCD digits
    if (hex.length >= 12) {
      // Parse each byte as BCD
      const bytes = hex.match(/.{2}/g) || [];

      if (bytes.length >= 6) {
        // Helper function to parse BCD byte
        const parseBCDByte = (hexByte: string) => {
          const byte = parseInt(hexByte, 16);
          const highNibble = (byte >> 4) & 0x0f; // First digit
          const lowNibble = byte & 0x0f; // Second digit
          return highNibble * 10 + lowNibble;
        };

        result.year = parseBCDByte(bytes[0]!) + 2000; // 25 -> 2025
        result.month = parseBCDByte(bytes[1]!); // 11 -> November
        result.day = parseBCDByte(bytes[2]!); // 20 -> day 20
        result.hour = parseBCDByte(bytes[3]!); // 11 -> 11:00
        result.minute = parseBCDByte(bytes[4]!); // 43 -> :43
        result.second = parseBCDByte(bytes[5]!); // 48 -> :48

        // Validate ranges
        if (result.month < 1 || result.month > 12) {
          result.month = 1;
        }
        if (result.day < 1 || result.day > 31) {
          result.day = 1;
        }
        if (result.hour > 23) {
          result.hour = 0;
        }
        if (result.minute > 59) {
          result.minute = 0;
        }
        if (result.second > 59) {
          result.second = 0;
        }

        // Format as YYYY-MM-DD HH:mm:ss
        result.gpsTime = `${result.year}-${result.month.toString().padStart(2, "0")}-${result.day.toString().padStart(2, "0")} ${result.hour.toString().padStart(2, "0")}:${result.minute.toString().padStart(2, "0")}:${result.second.toString().padStart(2, "0")}`;
      }
    }
  } catch (error: any) {
    // console.error("Time parsing error:", error, "Hex:", hex);
    result.gpsTime = "invalid_time";
    result.error = error.message;
  }
  return result;
}

/**
 * Parse extension value based on type
 */
export function parseExtensionValue(tag: number, valueHex: string): any {
  try {
    switch (tag) {
      case 0x30: // GSM Signal
      case 0x31: // Satellite Count
      case 0x15: // Satellite ID
        return parseInt(valueHex, 16);
      case 0xeb: // Cell Tower
        return Buffer.from(valueHex, "hex").toString("ascii");
      default:
        return valueHex;
    }
  } catch (e) {
    return valueHex;
  }
}

/**
 * Get message type description from message ID
 */
export function getMessageType(messageId: string): string {
  const types: Record<string, string> = {
    "0001": "Terminal General Response (Heartbeat)",
    "0002": "Terminal Heartbeat",
    "0100": "Terminal Registration",
    "0102": "Terminal Authentication",
    "0104": "Query Terminal Parameters Response",
    "0200": "Location Report",
    "0201": "Location Query Response",
    "0500": "Vehicle Control Response",
    "0704": "Batch Location Upload",
    "0800": "Multimedia Event Upload",
    "0801": "Multimedia Data Upload",
    "0900": "Data Upload Transparent",
    "8001": "Platform General Response",
    "8100": "Terminal Registration Response",
    "8103": "Set Terminal Parameters",
    "8104": "Query Terminal Parameters",
    "8105": "Terminal Control",
    "8106": "Query Specific Terminal Parameters",
    "8300": "Text Message",
    "8400": "Phone Book",
    "8500": "Vehicle Control",
  };

  return types[messageId] || `Unknown (0x${messageId})`;
}

/**
 * Get encryption type from body properties
 */
export function getEncryptionType(bodyProperties: number): string {
  const encType = (bodyProperties >> 10) & 0x07;
  const types = [
    "None",
    "RSA",
    "Reserved",
    "Reserved",
    "Reserved",
    "Reserved",
    "Reserved",
    "Reserved",
  ];
  return types[encType] || "Unknown";
}

/**
 * Get ACK status description
 */
export function getAckStatus(ackResult: number): string {
  const statuses: Record<number, string> = {
    0: "Success",
    1: "Failure",
    2: "Message Error",
    3: "Not Supported",
    4: "Alarm Processed",
  };
  return statuses[ackResult] || `Unknown (${ackResult})`;
}

/**
 * Get GPS fix quality based on satellite count and located status
 */
export function getGPSFixQuality(
  satelliteCount: number,
  located: boolean,
): string {
  if (!located || !satelliteCount) return "No Fix";
  if (satelliteCount >= 8) return "Excellent (8+ satellites)";
  if (satelliteCount >= 6) return "Good (6-7 satellites)";
  if (satelliteCount >= 4) return "Fair (4-5 satellites)";
  return "Poor (< 4 satellites)";
}

/**
 * Get signal quality description
 */
export function getAccurateSignalQuality(strength: number): string {
  if (!strength || strength === 0) return "No Signal";
  const percentage = Math.round((strength / 31) * 100);
  if (percentage >= 80) return `Excellent (${percentage}%)`;
  if (percentage >= 60) return `Good (${percentage}%)`;
  if (percentage >= 40) return `Fair (${percentage}%)`;
  if (percentage >= 20) return `Poor (${percentage}%)`;
  return `Very Poor (${percentage}%)`;
}

/**
 * Detect if device is J42 based on device ID
 */
export function isJ42Device(deviceId: string | number): boolean {
  const j42Patterns = [
    /^01409/, // J42 device ID prefix
    /^123456789$/, // Example from your packet
    /ALM-CLK/, // Device mode in responses
  ];

  return j42Patterns.some((pattern) => pattern.test(deviceId.toString()));
}
