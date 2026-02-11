/**
 * Packets Routes
 * Define packet-related HTTP endpoints
 */

import { FastifyInstance } from "fastify";
import { PacketsController } from "../controllers/packets.controller";

export default async function packetsRoutes(
  fastify: FastifyInstance,
  opts: any,
) {
  const controller: PacketsController = fastify.packetsController;

  // GET /api/packets/raw - Get raw packet data
  fastify.get<{
    Querystring: { limit?: string; deviceId?: string };
  }>("/api/packets/raw", async (request, reply) => {
    return controller.getRaw(request, reply);
  });

  // GET /api/packets/parsed - Get parsed packets with filtering
  fastify.get<{
    Querystring: {
      limit?: string;
      deviceId?: string;
      messageType?: string;
      startTime?: string;
      endTime?: string;
    };
  }>("/api/packets/parsed", async (request, reply) => {
    if (!request.query.deviceId) {
      return reply.code(400).send({
        success: false,
        message: "Device ID is required",
      });
    }

    return controller.getParsed(request, reply);
  });

  // GET /api/packets/acks - Get acknowledgement packets
  fastify.get<{
    Querystring: {
      limit?: string;
      deviceId?: string;
      startTime?: string;
      endTime?: string;
    };
  }>("/api/packets/acks", async (request, reply) => {
    return controller.getAcks(request, reply);
  });

  // GET /api/packets/gps/all - Get all GPS logs
  fastify.get("/api/packets/gps/all", async (request, reply) => {
    return controller.getAllGpsLogs(request, reply);
  });

  // GET /api/packets/acks/all - Get all ACK logs
  fastify.get("/api/packets/acks/all", async (request, reply) => {
    return controller.getAllAckLogs(request, reply);
  });

  // GET /api/packets/summary - Get simplified packet data
  fastify.get<{
    Querystring: {
      limit?: string;
      deviceId?: string;
    };
  }>("/api/packets/summary", async (request, reply) => {
    return controller.getSummary(request, reply);
  });

  // GET /api/packets/stats - Get statistics
  fastify.get("/api/packets/stats", async (request, reply) => {
    return controller.getStats(request, reply);
  });

  // GET /api/packets/:index - Get packet by index
  fastify.get<{
    Params: { index: string };
  }>("/api/packets/:index", async (request, reply) => {
    return controller.getByIndex(request, reply);
  });

  // POST /api/packets/decode - Decode raw data
  fastify.post<{
    Body: { data: string; format?: "hex" | "base64" };
  }>("/api/packets/decode", async (request, reply) => {
    return controller.decode(request, reply);
  });
}
