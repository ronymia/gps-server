/**
 * Health Routes
 * Health check and status endpoints
 */

import { FastifyInstance } from "fastify";

export default async function healthRoutes(
  fastify: FastifyInstance,
  opts: any,
) {
  // GET /health - Basic health check
  fastify.get("/health", async (request, reply) => {
    return {
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  });

  // GET /api/status - Detailed server status
  fastify.get("/api/status", async (request, reply) => {
    const packetService = fastify.packetService;
    const deviceService = fastify.deviceService;

    return {
      success: true,
      data: {
        server: {
          status: "running",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        packets: {
          total: packetService.count(),
        },
        devices: {
          connected: deviceService.count(),
          list: deviceService.getAll().map((d) => ({
            deviceId: d.deviceId,
            protocol: d.connection.protocol,
            lastSeen: d.connection.lastSeen,
          })),
        },
      },
    };
  });
}
