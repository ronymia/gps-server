/**
 * Packet Storage Service
 * Handles packet storage, filtering, and retrieval
 */

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { FastifyInstance } from "fastify";
import { DeviceLoggerService } from "./device-logger.service";

// Extend dayjs with comparison plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export class PacketService {
  private packets: any[] = [];
  private readonly MAX_PACKETS = 1000;
  private fastify: FastifyInstance;
  private deviceLogger: DeviceLoggerService;
  private seenRawData: Set<string> = new Set();

  constructor(fastify: FastifyInstance, deviceLogger?: DeviceLoggerService) {
    this.fastify = fastify;
    this.deviceLogger = deviceLogger || new DeviceLoggerService(fastify.log);
  }

  /**
   * Store a new packet (in-memory + database)
   */
  async store(packet: any): Promise<void> {
    // Check for duplicate raw data
    const rawHex = packet.raw || packet.rawHex;
    if (rawHex && this.seenRawData.has(rawHex)) {
      this.fastify.log.warn(
        `🔄 DUPLICATE packet detected: ${rawHex.substring(0, 40)}${rawHex.length > 40 ? "..." : ""}`,
      );
      this.fastify.log.warn(
        `   Device: ${packet.deviceId || "unknown"}, Type: ${packet.messageType || "unknown"}`,
      );
      return; // Ignore duplicate
    }

    // Add to seen set if raw data exists
    if (rawHex) {
      this.seenRawData.add(rawHex);

      // Limit seen set size to prevent memory overflow
      if (this.seenRawData.size > 10000) {
        // Convert to array, remove oldest 1000, convert back
        const arr = Array.from(this.seenRawData);
        this.seenRawData = new Set(arr.slice(1000));
      }
    }

    // Encode packet with detailed structure
    const encodedPacket = this.encodeDetailedStructure(packet);

    // Save to raw log files (per-device, 7-day rotation)
    if (encodedPacket.deviceId) {
      // 1. File Logger (Existing)
      await this.deviceLogger.logPacket(
        encodedPacket.deviceId,
        encodedPacket,
        "gps",
      );
    }
  }

  /**
   * Log an acknowledgement packet
   */
  async logAck(deviceId: string, ackData: any): Promise<void> {
    const packet = {
      ...ackData,
      type: "acknowledgement",
      timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    };

    await this.deviceLogger.logPacket(deviceId, packet, "ack");
  }

  /**
   * Encode packet with detailed structure format
   */
  private encodeDetailedStructure(packet: any): any {
    const rawHex = packet.raw || packet.rawHex || "";
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

    return {
      type: packet.type || "jt808_packet",
      raw: rawHex,
      length: packet.length || rawHex.length / 2,
      timestamp: now,
      accurate: packet.accurate !== false,
      detailed: {
        packetStructure: {
          startFlag: {
            hex: rawHex.startsWith("7e") ? "7E" : "N/A",
            decimal: 126,
            description: "Packet Start Marker",
          },
          endFlag: {
            hex: rawHex.endsWith("7e") ? "7E" : "N/A",
            decimal: 126,
            description: "Packet End Marker",
          },
          checksum: {
            hex: packet.checksumReceived || "N/A",
            decimal: packet.checksumReceived
              ? parseInt(packet.checksumReceived, 16)
              : 0,
            description: "XOR checksum",
            valid: packet.checksumValid,
          },
        },
        header: {
          messageId: {
            hex: packet.messageIdHex || packet.messageId || "N/A",
            decimal: packet.messageIdDec || 0,
            description: packet.messageType || "Unknown",
          },
          bodyProperties: {
            hex: "N/A",
            decimal: 0,
            details: {
              version: packet.version || "JTT2013",
              isEncrypted: packet.isEncrypted || false,
              isSubPacket: packet.isSubPacket || false,
              encryptionType: packet.encryptionType || "None",
              bodyLength: packet.bodyLength || 0,
            },
          },
          deviceId: {
            hex: packet.deviceIdRaw || "N/A",
            value: packet.deviceId || "unknown",
            description: "Device Phone Number",
          },
          sequenceNumber: {
            hex: packet.sequenceHex || "N/A",
            decimal: packet.sequence || 0,
            description: `Message Sequence #${packet.sequence || 0}`,
          },
        },
        body: packet.bodyHex
          ? { hex: packet.bodyHex, parsed: this.extractBodyParsedData(packet) }
          : {},
        extensions: packet.extensions || {},
        power: packet.power || {},
        battery: packet.battery || {},
        cellTower: packet.cellTowerInfo || packet.cellTower || {},
        movementStatus: packet.movementStatus || {},
        dataQuality: packet.dataQuality || {},
      },
      messageId: packet.messageId,
      messageIdHex: packet.messageIdHex || packet.messageId,
      messageIdDec: packet.messageIdDec || 0,
      messageType: packet.messageType,
      bodyLength: packet.bodyLength || 0,
      version: packet.version || "JTT2013",
      isEncrypted: packet.isEncrypted || false,
      isSubPacket: packet.isSubPacket || false,
      encryptionType: packet.encryptionType || "None",
      deviceId: packet.deviceId,
      sequence: packet.sequence || 0,
      receivedAt: packet.receivedAt || now,
      rawHex: rawHex,
      rawAscii: packet.rawAscii || this.hexToAscii(rawHex),
      bufferLength: packet.length || rawHex.length / 2,
      parsedAt: now,
      // Include all parsed data at top level for easy access
      latitude: packet.latitude,
      longitude: packet.longitude,
      altitude: packet.altitude,
      speed: packet.speed,
      direction: packet.direction,
      gpsTime: packet.gpsTime,
      alarmFlag: packet.alarmFlag,
      statusFlag: packet.statusFlag,
      statusDetails: packet.statusDetails,
      alarmDetails: packet.alarmDetails,
      power: packet.power,
      battery: packet.battery,
      extensions: packet.extensions,
      extensionDetails: packet.extensionDetails,
      cellTower: packet.cellTowerInfo || packet.cellTower,
      cellTowerInfo: packet.cellTowerInfo,
      satelliteCount: packet.satelliteCount,
      signalStrength: packet.signalStrength,
      signalQuality: packet.signalQuality,
      fixQuality: packet.fixQuality,
      mileage: packet.mileage,
      fuelLevel: packet.fuelLevel,
      movementStatus: packet.movementStatus,
      dataQuality: packet.dataQuality,
    };
  }

  /**
   * Extract parsed body data from packet
   */
  private extractBodyParsedData(packet: any): any {
    const parsed: any = {};

    // Location data
    if (packet.latitude !== undefined) parsed.latitude = packet.latitude;
    if (packet.longitude !== undefined) parsed.longitude = packet.longitude;
    if (packet.altitude !== undefined) parsed.altitude = packet.altitude;
    if (packet.speed !== undefined) parsed.speed = packet.speed;
    if (packet.direction !== undefined) parsed.direction = packet.direction;
    if (packet.gpsTime !== undefined) parsed.gpsTime = packet.gpsTime;

    // Status data
    if (packet.alarmFlag !== undefined) parsed.alarmFlag = packet.alarmFlag;
    if (packet.statusFlag !== undefined) parsed.statusFlag = packet.statusFlag;
    if (packet.statusDetails !== undefined)
      parsed.statusDetails = packet.statusDetails;
    if (packet.alarmDetails !== undefined)
      parsed.alarmDetails = packet.alarmDetails;

    // Power/Battery data
    if (packet.power !== undefined) parsed.power = packet.power;
    if (packet.battery !== undefined) parsed.battery = packet.battery;

    // Extensions data
    if (packet.extensions !== undefined) parsed.extensions = packet.extensions;
    if (packet.extensionDetails !== undefined)
      parsed.extensionDetails = packet.extensionDetails;

    // Cell tower data
    if (packet.cellTowerInfo !== undefined)
      parsed.cellTower = packet.cellTowerInfo;
    if (packet.cellTower !== undefined) parsed.cellTower = packet.cellTower;

    // GPS/Signal quality
    if (packet.satelliteCount !== undefined)
      parsed.satelliteCount = packet.satelliteCount;
    if (packet.signalStrength !== undefined)
      parsed.signalStrength = packet.signalStrength;
    if (packet.signalQuality !== undefined)
      parsed.signalQuality = packet.signalQuality;
    if (packet.fixQuality !== undefined) parsed.fixQuality = packet.fixQuality;

    // Movement data
    if (packet.mileage !== undefined) parsed.mileage = packet.mileage;
    if (packet.fuelLevel !== undefined) parsed.fuelLevel = packet.fuelLevel;
    if (packet.movementStatus !== undefined)
      parsed.movementStatus = packet.movementStatus;

    // Data quality
    if (packet.dataQuality !== undefined)
      parsed.dataQuality = packet.dataQuality;
    // Movement data
    if (packet.mileage !== undefined) parsed.mileage = packet.mileage;
    if (packet.fuelLevel !== undefined) parsed.fuelLevel = packet.fuelLevel;

    // Auth/Registration
    if (packet.authCode !== undefined) parsed.authCode = packet.authCode;
    if (packet.provinceId !== undefined) parsed.provinceId = packet.provinceId;
    if (packet.cityId !== undefined) parsed.cityId = packet.cityId;
    if (packet.manufacturerId !== undefined)
      parsed.manufacturerId = packet.manufacturerId;
    if (packet.terminalModel !== undefined)
      parsed.terminalModel = packet.terminalModel;

    return parsed;
  }

  /**
   * Convert hex to ASCII representation
   */
  private hexToAscii(hex: string): string {
    try {
      const buffer = Buffer.from(hex, "hex");
      return buffer.toString("ascii");
    } catch {
      return "";
    }
  }

  /**
   * Get all packets with optional filtering
   * Now reads from log files instead of memory
   */
  async getAll(
    options: {
      limit?: number;
      deviceId?: string;
      messageType?: string;
      startTime?: string;
      endTime?: string;
    } = {},
  ): Promise<any[]> {
    // Use hardcoded device ID for now
    const deviceId = options.deviceId || "291078985963";

    // Read from log files
    const packets = await this.deviceLogger.getPackets(deviceId, 999999, "gps");
    let filtered = packets;

    // Filter by message type
    if (options.messageType) {
      filtered = filtered.filter((p) => p.messageType === options.messageType);
    }

    // Filter by time range
    if (options.startTime) {
      filtered = filtered.filter((p) =>
        dayjs(p.gpsTime).isSameOrAfter(dayjs(options.startTime)),
      );
    }

    if (options.endTime) {
      filtered = filtered.filter((p) =>
        dayjs(p.gpsTime).isSameOrBefore(dayjs(options.endTime)),
      );
    }

    // Apply limit
    const limit = options.limit || 1000;
    return filtered.slice(0, limit);
  }

  /**
   * Get acknowledgement packets
   */
  async getAcks(
    options: {
      deviceId?: string;
      startTime?: string;
      endTime?: string;
      limit?: number;
    } = {},
  ): Promise<any[]> {
    const deviceId = options.deviceId || "291078985963";

    // Read from ACK log files
    const packets = await this.deviceLogger.getPackets(deviceId, 999999, "ack");
    let filtered = packets;

    // Filter by time range
    if (options.startTime) {
      filtered = filtered.filter((p) =>
        dayjs(p.timestamp).isSameOrAfter(dayjs(options.startTime)),
      );
    }

    if (options.endTime) {
      filtered = filtered.filter((p) =>
        dayjs(p.timestamp).isSameOrBefore(dayjs(options.endTime)),
      );
    }

    // Apply limit
    const limit = options.limit || 1000;
    return filtered.slice(0, limit);
  }

  /**
   * Get all GPS logs for all devices
   */
  async getAllGpsLogs(): Promise<{ deviceId: string; logs: any[] }[]> {
    const devices = this.deviceLogger.getAllDevices();
    const result = [];

    for (const deviceId of devices) {
      const logs = await this.deviceLogger.getPackets(deviceId, 999999, "gps");
      result.push({ deviceId, logs });
    }

    return result;
  }

  /**
   * Get all ACK logs for all devices
   */
  async getAllAckLogs(): Promise<{ deviceId: string; logs: any[] }[]> {
    const devices = this.deviceLogger.getAllDevices();
    const result = [];

    for (const deviceId of devices) {
      const logs = await this.deviceLogger.getPackets(deviceId, 999999, "ack");
      result.push({ deviceId, logs });
    }

    return result;
  }

  /**
   * Get packet by index
   * Now reads from log files with hardcoded device ID
   */
  async getByIndex(index: number): Promise<any | null> {
    const deviceId = "291078985963"; // Hardcoded for now
    const packets = await this.deviceLogger.getPackets(deviceId);
    return packets[index] || null;
  }

  /**
   * Get packets by device ID
   * Now reads from log files
   */
  async getByDevice(deviceId: string, limit: number = 100): Promise<any[]> {
    const packets = await this.deviceLogger.getPackets(deviceId);
    return packets.slice(0, limit);
  }

  /**
   * Get raw (unparsed) packets
   * Now reads from log files with hardcoded device ID
   */
  async getRaw(limit: number = 100): Promise<any[]> {
    const deviceId = "291078985963"; // Hardcoded for now
    const packets = await this.deviceLogger.getPackets(deviceId);
    return packets
      .map((p) => ({
        receivedAt: p.receivedAt,
        raw: p.raw,
        source: p.source,
        deviceId: p.deviceId,
      }))
      .slice(0, limit);
  }

  /**
   * Get packet statistics
   * Now reads from log files with hardcoded device ID
   */
  async getStats(): Promise<any> {
    const deviceId = "291078985963"; // Hardcoded for now
    const packets = await this.deviceLogger.getPackets(deviceId);

    const total = packets.length;
    const byMessageType: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};

    packets.forEach((p) => {
      // Count by message type
      const msgType = p.messageType || "unknown";
      byMessageType[msgType] = (byMessageType[msgType] || 0) + 1;

      // Count by device
      if (p.deviceId) {
        byDevice[p.deviceId] = (byDevice[p.deviceId] || 0) + 1;
      }

      // Count by protocol
      const protocol = p.type || "unknown";
      byProtocol[protocol] = (byProtocol[protocol] || 0) + 1;
    });

    return {
      total,
      byMessageType,
      byDevice,
      byProtocol,
      oldestPacket: packets[packets.length - 1]?.receivedAt,
      newestPacket: packets[0]?.receivedAt,
    };
  }

  /**
   * Clear all packets
   */
  clear(): void {
    this.packets = [];
  }

  /**
   * Get packet count
   * Now reads from log files with hardcoded device ID
   */
  async count(): Promise<number> {
    const deviceId = "291078985963"; // Hardcoded for now
    const packets = await this.deviceLogger.getPackets(deviceId);
    return packets.length;
  }
}
