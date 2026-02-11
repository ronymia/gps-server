/**
 * Devices Routes
 * Define device-related HTTP endpoints
 */

import { FastifyInstance } from "fastify";
import { DevicesController } from "../controllers/devices.controller";

export default async function devicesRoutes(
  fastify: FastifyInstance,
  opts: any,
) {
  const controller: DevicesController = fastify.devicesController;

  // GET /api/devices - Get all connected devices
  fastify.get("/api/devices", async (request, reply) => {
    return controller.getAll(request, reply);
  });

  // GET /api/devices/logs - Get all devices that have logs
  fastify.get("/api/devices/logs", async (request, reply) => {
    return controller.getLogDevices(request, reply);
  });

  // GET /api/devices/:id - Get device details
  fastify.get<{
    Params: { id: string };
    Querystring: { packetLimit?: string };
  }>("/api/devices/:id", async (request, reply) => {
    return controller.getById(request, reply);
  });

  // GET /api/devices/:id/status - Get device status
  fastify.get<{
    Params: { id: string };
  }>("/api/devices/:id/status", async (request, reply) => {
    return controller.getStatus(request, reply);
  });
}
