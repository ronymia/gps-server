/**
 * Devices Controller
 * Handles HTTP requests for device-related endpoints
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { DeviceService } from "../services/device.service";
import { PacketService } from "../services/packet.service";
import { DeviceLoggerService } from "../services/device-logger.service";

export class DevicesController {
  constructor(
    private deviceService: DeviceService,
    private packetService: PacketService,
    private deviceLoggerService?: DeviceLoggerService,
  ) {}

  /**
   * GET /api/devices
   * Get all connected devices
   */
  async getAll(request: FastifyRequest, reply: FastifyReply) {
    const devices = this.deviceService.getAll();

    return {
      success: true,
      count: devices.length,
      data: devices.map((d) => ({
        deviceId: d.deviceId,
        protocol: d.connection.protocol,
        connectedAt: d.connection.connectedAt,
        lastSeen: d.connection.lastSeen,
        type: d.connection.type,
      })),
    };
  }

  /**
   * GET /api/devices/logs
   * Get all devices that have logs
   */
  async getLogDevices(request: FastifyRequest, reply: FastifyReply) {
    // If service not injected (e.g. in tests without full app), try to use internal instance or return empty
    // In production it will be injected
    const devices = this.deviceLoggerService
      ? this.deviceLoggerService.getAllDevices()
      : [];

    return {
      success: true,
      count: devices.length,
      data: devices,
    };
  }

  /**
   * GET /api/devices/:id
   * Get device details and recent packets
   */
  async getById(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { packetLimit?: string };
    }>,
    reply: FastifyReply,
  ) {
    const deviceId = request.params.id;
    const connection = this.deviceService.get(deviceId);

    if (!connection) {
      return reply.status(404).send({
        success: false,
        error: "Device not found or not connected",
      });
    }

    const packetLimit = parseInt(request.query.packetLimit || "50", 10);
    const packets = await this.packetService.getByDevice(deviceId, packetLimit);

    return {
      success: true,
      data: {
        deviceId,
        connection: {
          protocol: connection.protocol,
          connectedAt: connection.connectedAt,
          lastSeen: connection.lastSeen,
          type: connection.type,
        },
        packets: {
          count: packets.length,
          recent: packets,
        },
      },
    };
  }

  /**
   * GET /api/devices/:id/status
   * Get device connection status
   */
  async getStatus(
    request: FastifyRequest<{
      Params: { id: string };
    }>,
    reply: FastifyReply,
  ) {
    const deviceId = request.params.id;
    const isConnected = this.deviceService.isConnected(deviceId);

    return {
      success: true,
      data: {
        deviceId,
        connected: isConnected,
        connection: isConnected ? this.deviceService.get(deviceId) : null,
      },
    };
  }
}
