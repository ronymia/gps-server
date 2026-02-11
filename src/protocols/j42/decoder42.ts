/**
 * J42/JT808 Protocol Decoder
 * Main entry point for decoding J42 and JT808 protocol packets
 */

import dayjs from "dayjs";
import {
  parseLocationData,
  parseLocationExtensions,
} from "./handlers/location.handler";
import { parseAuthRequest } from "./handlers/auth.handler";
import { parseRegistrationRequest } from "./handlers/register.handler";
import { parseTerminalResponse } from "./handlers/heartbeat.handler";
import { getMessageType } from "./utils/parser";
import { unescape } from "./utils/escape";
import { calculateChecksum } from "./utils/checksum";
import { bcdToString } from "./utils/bcd";

/**
 * Main decoding function for J42/JT808 packets
 */
export function decodeJ42(ascii: string, buffer: Buffer, logger?: any): any {
  const hex = buffer.toString("hex");

  // JT808 Protocol Detection
  if (hex.startsWith("7e")) {
    return decodeJT808(hex, buffer, logger);
  }

  // Original J42 SMS commands and other fallback logic
  const parts = ascii.split(",");
  if (ascii.includes("YGVER")) {
    return {
      type: "version_query",
      raw: ascii,
      hex: hex,
      messageType: "version_query",
    };
  }
  if (ascii.includes("YGCX")) {
    return {
      type: "parameter_query",
      raw: ascii,
      hex: hex,
      messageType: "parameter_query",
    };
  }
  if (ascii.includes("YG,")) {
    return {
      type: "configuration_command",
      raw: ascii,
      hex: hex,
      messageType: "configuration_command",
    };
  }
  if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
    const result: any = {
      type: "possible_position",
      messageType: "position_report",
      imei: parts[0],
      timestamp: parts[1],
      latitude: parseFloat(parts[2]),
      longitude: parseFloat(parts[3]),
      raw: ascii,
      hex: hex,
    };
    return result;
  }
  return {
    type: "unknown",
    messageType: "unknown",
    raw: ascii,
    hex: hex,
    length: buffer.length,
  };
}

/**
 * Decode JT808 protocol packets with proper escape handling
 */
export function decodeJT808(hex: string, buffer: Buffer, logger?: any): any {
  const result: any = {
    type: "jt808_packet",
    raw: hex,
    length: buffer.length,
    timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    accurate: false,
    detailed: {
      packetStructure: {},
      header: {},
      body: {},
      extensions: {},
    },
    logger, // Attach logger for internal use
  };

  try {
    // 1. Validate packet structure (must start and end with 0x7E)
    if (!hex.startsWith("7e") || !hex.endsWith("7e")) {
      result.error = "Invalid JT808 packet: missing frame markers (0x7E)";
      return result;
    }

    // 2. Remove start/end markers
    const withoutMarkers = hex.substring(2, hex.length - 2);

    // 3. Convert to buffer and unescape
    const escapedBuffer = Buffer.from(withoutMarkers, "hex");
    const unescapedBuffer = unescape(escapedBuffer);

    // 4. Verify minimum length
    if (unescapedBuffer.length < 13) {
      result.error = "Packet too short after unescaping";
      return result;
    }

    // 5. Extract checksum (last byte)
    const checksumByte = unescapedBuffer[unescapedBuffer.length - 1];
    const dataForChecksum = unescapedBuffer.slice(0, -1);

    // 6. Verify checksum
    const calculatedChecksum = calculateChecksum(dataForChecksum);
    result.checksumReceived = checksumByte.toString(16).padStart(2, "0");
    result.checksumCalculated = calculatedChecksum
      .toString(16)
      .padStart(2, "0");
    result.checksumValid = checksumByte === calculatedChecksum;

    if (!result.checksumValid) {
      result.error = `Checksum mismatch: expected ${result.checksumCalculated}, got ${result.checksumReceived}`;
      result.warning = "Proceeding with parsing despite checksum error";
    }

    // 7. Parse header from unescaped data
    const cleanHex = dataForChecksum.toString("hex");
    let pos = 0;

    // Message ID (2 bytes)
    result.messageId = cleanHex.substring(pos, pos + 4);
    result.messageIdHex = result.messageId;
    result.messageIdDec = parseInt(result.messageId, 16);
    result.messageType = getMessageType(result.messageId);
    pos += 4;

    // Body Properties (2 bytes)
    const bodyProperties = parseInt(cleanHex.substring(pos, pos + 4), 16);
    result.bodyLength = bodyProperties & 0x03ff;
    result.isEncrypted = !!(bodyProperties & 0x0400);
    result.isSubPacket = !!(bodyProperties & 0x2000);
    result.reserved = (bodyProperties >> 13) & 0x07;
    pos += 4;

    // Protocol Version Detection
    if (bodyProperties & 0x4000) {
      result.version = "JTT2019";
      result.protocolVersion = 1;
    } else {
      result.version = "JTT2013";
      result.protocolVersion = 0;
    }

    // Terminal ID (6 bytes BCD for 2013, 10 bytes for 2019)
    const terminalIdLength = result.version === "JTT2019" ? 20 : 12;
    const terminalIdHex = cleanHex.substring(pos, pos + terminalIdLength);

    // Parse BCD device ID
    const deviceIdBuffer = Buffer.from(terminalIdHex, "hex");
    result.deviceId = bcdToString(deviceIdBuffer);
    result.deviceIdRaw = terminalIdHex;
    pos += terminalIdLength;

    // Sequence number (2 bytes)
    result.sequence = parseInt(cleanHex.substring(pos, pos + 4), 16);
    result.sequenceHex = cleanHex.substring(pos, pos + 4);
    pos += 4;

    // Handle sub-packet info if present
    if (result.isSubPacket) {
      result.totalPackets = parseInt(cleanHex.substring(pos, pos + 4), 16);
      pos += 4;
      result.packetNumber = parseInt(cleanHex.substring(pos, pos + 4), 16);
      pos += 4;
    }

    // Extract body
    const bodyStartPos = pos;
    const bodyHex = cleanHex.substring(
      bodyStartPos,
      bodyStartPos + result.bodyLength * 2,
    );
    result.bodyHex = bodyHex;
    result.bodyActualLength = bodyHex.length / 2;

    // Validate body length
    if (result.bodyActualLength !== result.bodyLength) {
      result.warning = `Body length mismatch: expected ${result.bodyLength}, got ${result.bodyActualLength}`;
    }

    result.accurate = true;

    // Parse message body based on type
    parseMessageBody(result, bodyHex);

    // Create detailed breakdown structure
    createDetailedBreakdown(result, hex, cleanHex);
  } catch (error: any) {
    result.error = `Parser failed: ${error.message}`;
    result.stackTrace = error.stack;
    result.accurate = false;
  }

  return result;
}

/**
 * Parse message body based on message type
 */
function parseMessageBody(result: any, bodyHex: string): void {
  try {
    switch (result.messageId) {
      case "0102": // Terminal Authentication
        const authData = parseAuthRequest(bodyHex);
        Object.assign(result, authData);
        result.ackRequired = true;
        break;

      case "0002": // Terminal Heartbeat (usually empty body)
        if (bodyHex.length === 0) {
          result.messageType = "heartbeat";
          result.bodyEmpty = true;
        } else {
          const responseData = parseTerminalResponse(bodyHex);
          Object.assign(result, responseData);
        }
        result.ackRequired = true;
        break;

      case "0001": // Terminal General Response
        const generalResponse = parseTerminalResponse(bodyHex);
        Object.assign(result, generalResponse);
        break;

      case "0100": // Terminal Registration
        const regData = parseRegistrationRequest(bodyHex);
        Object.assign(result, regData);
        result.ackRequired = true;
        break;

      case "0200": // Location Report
        const locationData = parseLocationData(
          bodyHex,
          result.deviceId,
          result.logger,
        );
        Object.assign(result, locationData);

        // Parse extensions if present
        const extensionStartPos = 56; // After basic location fields (28 bytes)
        if (bodyHex.length > extensionStartPos) {
          const extensionHex = bodyHex.substring(extensionStartPos);
          const extensionData = parseLocationExtensions(
            extensionHex,
            result.statusDetails,
            result.logger,
          );
          Object.assign(result, extensionData);
        }
        result.ackRequired = true;
        break;

      case "0704": // Batch Location Upload
        result.batchData = parseBatchLocationUpload(
          bodyHex,
          result.deviceId,
          result.logger,
        );
        result.ackRequired = true;
        break;

      default:
        result.bodyParsed = false;
        result.bodyRaw = bodyHex;
        break;
    }
  } catch (error: any) {
    result.bodyParseError = error.message;
    result.bodyRaw = bodyHex;
  }
}

/**
 * Parse batch location upload (0x0704)
 */
function parseBatchLocationUpload(
  bodyHex: string,
  deviceId: string,
  logger?: any,
): any {
  const result: any = {
    count: 0,
    locations: [],
  };

  try {
    let pos = 0;

    // Item count (2 bytes)
    result.count = parseInt(bodyHex.substring(pos, pos + 4), 16);
    pos += 4;

    // Location type (1 byte)
    result.locationType = parseInt(bodyHex.substring(pos, pos + 2), 16);
    pos += 2;

    // Parse each location item
    for (let i = 0; i < result.count; i++) {
      // Item length (2 bytes)
      const itemLength = parseInt(bodyHex.substring(pos, pos + 4), 16);
      pos += 4;

      // Location data
      const locationHex = bodyHex.substring(pos, pos + itemLength * 2);
      const location = parseLocationData(locationHex, deviceId, logger);

      // Parse extensions if present
      if (locationHex.length > 56) {
        const extHex = locationHex.substring(56);
        const extData = parseLocationExtensions(
          extHex,
          location.statusDetails,
          logger,
        );
        Object.assign(location, extData);
      }

      result.locations.push(location);
      pos += itemLength * 2;
    }
  } catch (error: any) {
    result.error = error.message;
  }

  return result;
}

/**
 * Get encryption type from body properties
 */
function getEncryptionType(bodyProperties: number): string {
  const encryptionBits = (bodyProperties >> 10) & 0x07;
  const types: Record<number, string> = {
    0: "None",
    1: "RSA",
    2: "AES128",
    3: "Invalid",
    4: "Invalid",
    5: "Invalid",
    6: "Invalid",
    7: "Invalid",
  };
  return types[encryptionBits] || "Unknown";
}

/**
 * Create detailed breakdown structure (like packet-parser.js)
 */
function createDetailedBreakdown(
  result: any,
  hex: string,
  cleanHex: string,
): void {
  try {
    // Packet structure details
    result.detailed.packetStructure = {
      startFlag: {
        hex: "7E",
        decimal: 126,
        description: "Packet Start Marker",
      },
      endFlag: {
        hex: "7E",
        decimal: 126,
        description: "Packet End Marker",
      },
      checksum: {
        hex: result.checksumReceived || "N/A",
        decimal: result.checksumReceived
          ? parseInt(result.checksumReceived, 16)
          : 0,
        description: "XOR checksum",
        valid: result.checksumValid,
      },
    };

    // Header details
    result.detailed.header = {
      messageId: {
        hex: result.messageIdHex,
        decimal: result.messageIdDec,
        description: result.messageType,
      },
      bodyProperties: {
        hex: "N/A",
        decimal: 0,
        details: {
          version: result.version,
          isEncrypted: result.isEncrypted,
          isSubPacket: result.isSubPacket,
          encryptionType: getEncryptionType(0),
          bodyLength: result.bodyLength,
        },
      },
      deviceId: {
        hex: result.deviceIdRaw || "N/A",
        value: result.deviceId,
        description: "Device Phone Number",
      },
      sequenceNumber: {
        hex: result.sequenceHex || "N/A",
        decimal: result.sequence,
        description: `Message Sequence #${result.sequence}`,
      },
    };

    // Body details (for location reports) - detailed breakdown format
    if (result.messageId === "0200" && result.bodyHex) {
      result.detailed.body = {
        alarmFlag: {
          hex: result.alarmFlagHex || "N/A",
          decimal: result.alarmFlag,
          binary: result.alarmFlag?.toString(2).padStart(32, "0") || "N/A",
          details: result.alarmDetails || {},
        },
        statusFlag: {
          hex: result.statusFlagHex || "N/A",
          decimal: result.statusFlag,
          binary: result.statusFlag?.toString(2).padStart(32, "0") || "N/A",
          details: result.statusDetailsExtended || result.statusDetails || {},
        },
        latitude: {
          hex: result.latitudeHex || "N/A",
          decimal: result.latitudeDec || 0,
          degrees: result.latitude || 0,
          description: `${result.latitude?.toFixed(6)}° ${result.statusDetails?.isSouth ? "S" : "N"}`,
        },
        longitude: {
          hex: result.longitudeHex || "N/A",
          decimal: result.longitudeDec || 0,
          degrees: result.longitude || 0,
          description: `${result.longitude?.toFixed(6)}° ${result.statusDetails?.isWest ? "W" : "E"}`,
        },
        altitude: {
          hex: result.altitudeHex || "N/A",
          decimal: result.altitude || 0,
          description: `${result.altitude || 0} meters`,
        },
        speed: {
          hex: result.speedHex || "N/A",
          decimal: result.speedRaw || 0,
          kmh: result.speed || 0,
          description: `${result.speed?.toFixed(1) || 0} km/h`,
        },
        direction: {
          hex: result.directionHex || "N/A",
          decimal: result.direction || 0,
          description: `${result.direction || 0}°`,
        },
        time: {
          hex: result.gpsTimeHex || "N/A",
          decoded: result.gpsTime || "N/A",
          components: {
            year: result.year || 0,
            month: result.month || 0,
            day: result.day || 0,
            hour: result.hour || 0,
            minute: result.minute || 0,
            second: result.second || 0,
          },
          description: `UTC Time: ${result.gpsTime || "N/A"}`,
        },
      };
    }

    // Extensions - map to detailed format with id, name, length, value, description
    if (result.extensions && result.extensions.length > 0) {
      result.detailed.extensions = result.extensions.map((ext: any) => ({
        id: `0x${ext.idHex?.toUpperCase() || ext.id?.toString(16).toUpperCase()}`,
        name: ext.name || `Extension 0x${ext.idHex}`,
        length: ext.length,
        value: ext.value,
        description:
          ext.description || ext.decoded?.description || "Unknown data",
        details: ext,
      }));
    }

    // Add power/battery info if available
    if (result.power?.battery) {
      result.detailed.power = result.power;
    }

    // Add cell tower info if available
    if (result.cellTowerInfo) {
      result.detailed.cellTower = result.cellTowerInfo;
    }

    // Add movement status
    if (result.speed !== undefined) {
      result.detailed.movementStatus = {
        isMoving: result.speed > 0.5,
        speed: result.speed,
        description:
          result.speed > 0.5
            ? `Moving at ${result.speed.toFixed(1)} km/h`
            : "Stationary",
      };
      // Also add to top level for easy access
      result.movementStatus = result.detailed.movementStatus;
    }

    // Add data quality metrics
    if (
      result.satelliteCount !== undefined ||
      result.signalStrength !== undefined
    ) {
      result.detailed.dataQuality = {
        gpsQuality: result.fixQuality,
        satelliteCount: result.satelliteCount,
        signalQuality: result.signalQuality,
        signalStrength: result.signalStrength,
      };
      // Also add to top level for easy access
      result.dataQuality = result.detailed.dataQuality;
    }

    // Add mileage if available
    if (result.mileage !== undefined) {
      result.detailed.mileage = result.mileage;
    }

    // Add fuel level if available
    if (result.fuelLevel !== undefined) {
      result.detailed.fuelLevel = result.fuelLevel;
    }
  } catch (error: any) {
    result.detailed.error = `Failed to create detailed breakdown: ${error.message}`;
  }
}
