/**
 * Routes Index
 * Register all route modules
 */

import { FastifyInstance } from "fastify";
import healthRoutes from "./health.routes";
import packetsRoutes from "./packets.routes";
import devicesRoutes from "./devices.routes";
import commandsRoutes from "./commands.routes";
import responseLoggerController from "../controllers/response-logger.controller";

export default async function routes(fastify: FastifyInstance, opts: any) {
  // Register all route modules
  await fastify.register(healthRoutes);
  await fastify.register(packetsRoutes);
  await fastify.register(devicesRoutes);
  await fastify.register(commandsRoutes);
  await fastify.register(responseLoggerController, { prefix: "/api" });
}
