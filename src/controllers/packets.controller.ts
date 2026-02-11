/**
 * Packets Controller
 * Handles HTTP requests for packet-related endpoints
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { PacketService } from "../services/packet.service";
import { DecoderService } from "../services/decoder.service";

export class PacketsController {
  constructor(
    private packetService: PacketService,
    private decoderService: DecoderService,
  ) {}

  /**
   * GET /api/packets/raw
   * Get raw packet data
   */
  async getRaw(
    request: FastifyRequest<{
      Querystring: { limit?: string; deviceId?: string };
    }>,
    reply: FastifyReply,
  ) {
    const limit = parseInt(request.query.limit || "100", 10);
    const packets = await this.packetService.getRaw(limit);

    return {
      success: true,
      count: packets.length,
      data: packets,
    };
  }

  /**
   * GET /api/packets/parsed
   * Get parsed packet data with filtering
   */
  async getParsed(
    request: FastifyRequest<{
      Querystring: {
        limit?: string;
        deviceId?: string;
        messageType?: string;
        startTime?: string;
        endTime?: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    const options = {
      limit: request.query.limit ? parseInt(request.query.limit) : undefined,
      deviceId: request.query.deviceId,
      messageType: request.query.messageType,
      startTime: request.query.startTime,
      endTime: request.query.endTime,
    };
    const packets = await this.packetService.getAll(options);

    return {
      success: true,
      count: packets.length,
      filters: options,
      data: packets,
    };
  }

  /**
   * GET /api/packets/acks
   * Get acknowledgement packets
   */
  async getAcks(
    request: FastifyRequest<{
      Querystring: {
        limit?: string;
        deviceId?: string;
        startTime?: string;
        endTime?: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    const options = {
      limit: request.query.limit ? parseInt(request.query.limit) : undefined,
      deviceId: request.query.deviceId,
      startTime: request.query.startTime,
      endTime: request.query.endTime,
    };
    const packets = await this.packetService.getAcks(options);

    return {
      success: true,
      count: packets.length,
      filters: options,
      data: packets,
    };
  }

  /**
   * GET /api/packets/gps/all
   * Get all GPS logs
   */
  async getAllGpsLogs(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.packetService.getAllGpsLogs();
    return {
      success: true,
      count: data.length,
      data,
    };
  }

  /**
   * GET /api/packets/acks/all
   * Get all ACK logs
   */
  async getAllAckLogs(request: FastifyRequest, reply: FastifyReply) {
    const data = await this.packetService.getAllAckLogs();
    return {
      success: true,
      count: data.length,
      data,
    };
  }

  /**
   * GET /api/packets/summary
   * Get simplified packet data
   */
  async getSummary(
    request: FastifyRequest<{
      Querystring: {
        limit?: string;
        deviceId?: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    const limit = parseInt(request.query.limit || "100", 10);
    const options = {
      limit,
      deviceId: request.query.deviceId,
    };

    // Get all packets (filtering applied in service)
    const packets = await this.packetService.getAll(options);

    // Map to simplified structure
    const simplifiedData = packets.map((packet, index) => {
      const speedKmh = packet.speed || 0;
      let speedDesc = "Slow";
      if (speedKmh > 80) speedDesc = "Fast";
      else if (speedKmh > 30) speedDesc = "Medium";

      // Try to find mileage in extensions
      let mileage = "0Kilometer";
      if (packet.extensions) {
        const mileageExt = packet.extensions.find((e: any) => e.id === "0x01"); // 0x01 is mileage
        if (mileageExt && mileageExt.decoded && mileageExt.decoded.value) {
          // value is like "123 km"
          mileage = mileageExt.decoded.value.replace(" km", "Kilometer");
        }
      }

      return {
        entry_id: index + 1,
        timestamp:
          packet.gpsTime || packet.receivedAt || new Date().toISOString(),
        speed: speedDesc,
        speed_kmh: speedKmh,
        mileage: mileage,
        // location_type: "GPS+BDS", // Placeholder/Default
        latitude: packet.latitude || 0,
        longitude: packet.longitude || 0,
        // duration: "0 Minutes", // Placeholder
        status: speedKmh > 0 ? "Moving" : "Stopped",
      };
    });

    return {
      success: true,
      count: simplifiedData.length,
      data: simplifiedData,
    };
  }

  /**
   * GET /api/packets/stats
   * Get packet statistics
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.packetService.getStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /api/packets/:index
   * Get packet by index
   */
  async getByIndex(
    request: FastifyRequest<{
      Params: { index: string };
    }>,
    reply: FastifyReply,
  ) {
    const index = parseInt(request.params.index, 10);
    const packet = await this.packetService.getByIndex(index);

    if (!packet) {
      return reply.status(404).send({
        success: false,
        error: "Packet not found",
      });
    }

    return {
      success: true,
      data: packet,
    };
  }

  /**
   * POST /api/packets/decode
   * Decode raw hex/base64 packet data
   */
  async decode(
    request: FastifyRequest<{
      Body: { data: string; format?: "hex" | "base64" };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const { data, format = "hex" } = request.body;

      let buffer: Buffer;
      if (format === "base64") {
        buffer = Buffer.from(data, "base64");
      } else {
        buffer = Buffer.from(data, "hex");
      }

      const decoded = this.decoderService.decode(buffer);

      return {
        success: true,
        data: decoded,
      };
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }
}
