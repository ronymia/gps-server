/**
 * Commands Routes
 * Define command-related HTTP endpoints
 */

import { FastifyInstance } from "fastify";
import { CommandsController } from "../controllers/commands.controller";

export default async function commandsRoutes(
  fastify: FastifyInstance,
  opts: any,
) {
  const controller: CommandsController = fastify.commandsController;

  // POST /api/commands - Send command to device
  fastify.post<{
    Body: {
      deviceId: string;
      commandType: string;
      parameters?: any;
    };
  }>("/api/commands", async (request, reply) => {
    return controller.send(request, reply);
  });
}
