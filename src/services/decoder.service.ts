/**
 * Decoder Service
 * Routes packets to appropriate protocol decoders
 */

import { FastifyBaseLogger } from "fastify";
import { decodeJ42 } from "../protocols/j42/decoder42";

export class DecoderService {
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Detect protocol from raw data
   */
  detectProtocol(data: Buffer): "j42" | "jtt808" | "jtt1078" | "unknown" {
    // Check for JTT1078 start flag 0x30316364 (ASCII "01cd")
    const hex = data.toString("hex");
    const ascii = data.toString("ascii");

    // Check for JTT1078 start flag 0x30316364 (ASCII "01cd")
    if (data.length >= 4) {
      const startFlag = data.readUInt32BE(0);
      if (startFlag === 0x30316364) {
        return "jtt1078";
      }
    }

    // JTT808/JTT1078 (JT/T 808) start with 0x7E
    if (hex.startsWith("7e")) {
      // Check if it ends with 0x7E for valid packet
      if (!hex.endsWith("7e")) {
        if (this.logger) this.logger.warn("JTT packet missing end marker");
      }

      // Distinguish between JTT808 and JTT1078 by message ID
      // JTT1078 message IDs are in the range 0x1000-0x1FFF
      if (data.length >= 3) {
        const messageId = data.readUInt16BE(1);

        // JTT1078 message IDs
        if (messageId >= 0x1000 && messageId <= 0x1fff) {
          return "jtt1078";
        }

        // Common JTT1078 message types
        if (
          messageId === 0x1003 || // Terminal upload audio/video attributes
          messageId === 0x1005 || // Terminal upload audio/video data
          messageId === 0x9101 || // Real-time audio/video request
          messageId === 0x9102 || // Audio/video control
          messageId === 0x9105 // Real-time audio/video status
        ) {
          return "jtt1078";
        }
      }

      // Default to JTT808
      return "jtt808";
    }

    // J42 patterns
    if (
      ascii.includes("YG,") ||
      ascii.includes("YGVER") ||
      ascii.includes("YGCX")
    ) {
      return "j42";
    }

    // Check for comma-separated position data (J42 SMS format)
    const parts = ascii.split(",");
    if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
      return "j42";
    }

    return "unknown";
  }

  /**
   * Decode packet using appropriate decoder
   */
  decode(data: Buffer, protocol?: string): any {
    const detectedProtocol = protocol || this.detectProtocol(data);

    try {
      switch (detectedProtocol) {
        case "j42":
        case "jtt808":
          // decoder42 handles both J42 and JTT808 protocols
          return this.decodeJ42(data);
        case "jtt1078":
          return this.decodeJTT1078(data);
        default:
          return {
            type: "unknown",
            protocol: "unknown",
            raw: data.toString("hex"),
            error: "Unknown protocol",
            suggestions: this.suggestProtocol(data),
          };
      }
    } catch (error: any) {
      return {
        type: "decode_error",
        protocol: detectedProtocol,
        raw: data.toString("hex"),
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Decode J42/JTT808 protocol
   */
  private decodeJ42(data: Buffer): any {
    const ascii = data.toString("ascii");
    return decodeJ42(ascii, data, this.logger);
  }

  /**
   * Decode JTT1078 protocol (video)
   */
  private decodeJTT1078(data: Buffer): any {
    // TODO: Import from jtt1078 decoder when available
    const hex = data.toString("hex");
    return {
      type: "jtt1078",
      protocol: "jtt1078",
      raw: hex,
      todo: "Implement JTT1078 decoder",
    };
  }

  /**
   * Provide protocol suggestions based on data analysis
   */
  private suggestProtocol(data: Buffer): string[] {
    const suggestions: string[] = [];
    const hex = data.toString("hex");
    const ascii = data.toString("ascii");

    if (hex.match(/^[0-9a-f]+$/)) {
      suggestions.push("Appears to be hex data");
    }

    if (ascii.match(/^[\x20-\x7E]+$/)) {
      suggestions.push("Appears to be ASCII text");
    }

    if (data.length < 10) {
      suggestions.push("Packet too short - possible fragment");
    }

    return suggestions;
  }
}
