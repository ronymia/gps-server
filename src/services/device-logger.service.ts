/**
 * Device Logger Service
 * Per-device file logging with 7-day rotation
 */

import { FastifyBaseLogger } from "fastify";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

export class DeviceLoggerService {
  private loggers = new Map<string, winston.Logger>();
  private readonly LOG_DIR = path.join(process.cwd(), "logs", "devices");
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
    // Ensure base log directory exists
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }
  }

  /**
   * Get or create logger for specific device and log type
   */
  private getDeviceLogger(
    deviceId: string,
    logType: "gps" | "ack" = "gps",
  ): winston.Logger {
    const loggerKey = `${deviceId}:${logType}`;

    // Return cached logger if exists
    if (this.loggers.has(loggerKey)) {
      return this.loggers.get(loggerKey)!;
    }

    // Create device-specific log directory with sub-folder
    const subFolder = logType === "gps" ? "gps_log" : "acknowledgement_log";
    const deviceLogDir = path.join(this.LOG_DIR, deviceId, subFolder);

    if (!fs.existsSync(deviceLogDir)) {
      fs.mkdirSync(deviceLogDir, { recursive: true });
    }

    // Create daily rotate transport for this device
    const transport = new DailyRotateFile({
      dirname: deviceLogDir,
      filename: "%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: false,
      maxSize: "100m", // Rotate if file exceeds 100MB
      maxFiles: "7d", // Keep 7 days of logs
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        winston.format.json(),
      ),
    });

    // Create logger instance
    const logger = winston.createLogger({
      transports: [transport],
      exitOnError: false,
    });

    // Cache logger
    this.loggers.set(loggerKey, logger);

    return logger;
  }

  /**
   * Log packet data for a device
   */
  async logPacket(
    deviceId: string,
    packet: any,
    logType: "gps" | "ack" = "gps",
  ): Promise<void> {
    if (!deviceId) {
      return; // Skip if no deviceId
    }

    try {
      const logger = this.getDeviceLogger(deviceId, logType);

      // Log complete packet data
      logger.info({
        deviceId,
        protocol: packet.protocol,
        messageType: packet.messageType,
        rawHex: packet.raw,
        parsedData: packet,
        source: packet.clientId,
        receivedAt: packet.receivedAt,
      });
    } catch (error: any) {
      if (this.logger) {
        this.logger.error(
          `Failed to log packet for device ${deviceId}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Get path to device logs
   */
  getDeviceLogPath(deviceId: string): string {
    return path.join(this.LOG_DIR, deviceId);
  }

  /**
   * Read packets from log files for a device
   */
  async getPackets(
    deviceId: string,
    limit: number = 999999,
    logType: "gps" | "ack" = "gps",
  ): Promise<any[]> {
    if (this.logger) {
      this.logger.info(
        `[DeviceLogger] getPackets called - deviceId: ${deviceId}, limit: ${limit}, type: ${logType}`,
      );
    }
    const sanitizedDeviceId = path.basename(deviceId);
    const subFolder = logType === "gps" ? "gps_log" : "acknowledgement_log";
    const deviceLogDir = path.join(this.LOG_DIR, sanitizedDeviceId, subFolder);

    if (this.logger) {
      this.logger.info(`[DeviceLogger] Looking in: ${deviceLogDir}`);
    }

    // Check if directory exists
    if (!fs.existsSync(deviceLogDir)) {
      if (this.logger) {
        this.logger.info(`[DeviceLogger] Directory not found: ${deviceLogDir}`);
      }
      return [];
    }

    try {
      // Get all log files, sorted by date (newest first)
      const files = fs
        .readdirSync(deviceLogDir)
        .filter((f) => f.endsWith(".log"))
        .sort()
        .reverse();
      if (this.logger) {
        this.logger.info(
          `[DeviceLogger] Found ${files.length} log files: ${files}`,
        );
      }

      const packets: any[] = [];

      // Read files until we have enough packets or run out of files
      for (const file of files) {
        if (packets.length >= limit) break;

        const filePath = path.join(deviceLogDir, file);
        if (this.logger) {
          this.logger.info(`[DeviceLogger] Reading: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.trim().split("\n");
        if (this.logger) {
          this.logger.info(
            `[DeviceLogger] Found ${lines.length} lines in ${file}`,
          );
        }

        // Parse each line as JSON log entry (newest first)
        for (let i = lines.length - 1; i >= 0; i--) {
          if (packets.length >= limit) break;

          const line = lines[i].trim();
          if (!line) continue;

          try {
            const logEntry = JSON.parse(line);
            // Winston format: { level, message: { parsedData }, timestamp }
            if (logEntry.message && logEntry.message.parsedData) {
              packets.push(logEntry.message.parsedData);
            } else if (logEntry.parsedData) {
              // Fallback if format changes
              packets.push(logEntry.parsedData);
            } else {
              if (this.logger) {
                this.logger.info(
                  `[DeviceLogger] Line missing parsedData: ${line.substring(0, 100)}`,
                );
              }
            }
          } catch (parseError) {
            if (this.logger) {
              this.logger.info(
                `[DeviceLogger] Failed to parse line: ${line.substring(0, 100)}`,
              );
            }
            continue;
          }
        }
      }

      return packets;
    } catch (error: any) {
      if (this.logger) {
        this.logger.error(
          `Failed to read packets for device ${deviceId}: ${error.message}`,
        );
      }
      return [];
    }
  }

  /**
   * Close all loggers (cleanup on shutdown)
   */
  async shutdown(): Promise<void> {
    const closePromises = Array.from(this.loggers.values()).map(
      (logger) =>
        new Promise<void>((resolve) => {
          logger.close();
          resolve();
        }),
    );

    await Promise.all(closePromises);
    this.loggers.clear();
  }

  /**
   * Get list of all devices with logs
   */
  getAllDevices(): string[] {
    try {
      if (!fs.existsSync(this.LOG_DIR)) {
        return [];
      }
      return fs
        .readdirSync(this.LOG_DIR)
        .filter((file) =>
          fs.statSync(path.join(this.LOG_DIR, file)).isDirectory(),
        );
    } catch (error: any) {
      if (this.logger) {
        this.logger.error(
          `[DeviceLogger] Failed to list devices: ${error.message}`,
        );
      }
      return [];
    }
  }
}
