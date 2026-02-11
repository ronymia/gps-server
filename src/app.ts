/**
 * Fastify Application Setup
 * Creates and configures the Fastify instance
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { FASTIFY_CONFIG } from "./config";
import routes from "./routes";
import tcpServerPlugin from "./plugins/tcp-server.plugin";

// Services
import {
  PacketService,
  DeviceService,
  DecoderService,
  DeviceLoggerService,
} from "./services";
import { ResponseLoggerService } from "./services/response-logger.service";
import { MediaServerClient } from "./services/media-server.client";

// Controllers
import {
  PacketsController,
  DevicesController,
  CommandsController,
} from "./controllers";

// Fastify type extensions
declare module "fastify" {
  interface FastifyInstance {
    packetService: PacketService;
    deviceService: DeviceService;
    decoderService: DecoderService;
    deviceLoggerService: DeviceLoggerService;
    responseLogger: ResponseLoggerService;
    mediaServerClient: MediaServerClient;
    packetsController: PacketsController;
    devicesController: DevicesController;
    commandsController: CommandsController;
    tcpServer: any;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: FASTIFY_CONFIG.logger,
  });

  // Register CORS
  await app.register(cors, FASTIFY_CONFIG.cors);

  // Initialize services
  const deviceLoggerService = new DeviceLoggerService(app.log);
  const packetService = new PacketService(app, deviceLoggerService);
  const deviceService = new DeviceService();
  const decoderService = new DecoderService(app.log);

  // Decorate Fastify with services
  app.decorate("deviceLoggerService", deviceLoggerService);
  app.decorate("packetService", packetService);
  app.decorate("deviceService", deviceService);
  app.decorate("decoderService", decoderService);

  // Initialize controllers
  const packetsController = new PacketsController(
    packetService,
    decoderService,
  );
  const devicesController = new DevicesController(
    deviceService,
    packetService,
    deviceLoggerService,
  );
  const commandsController = new CommandsController(deviceService);

  // Decorate Fastify with controllers
  app.decorate("packetsController", packetsController);
  app.decorate("devicesController", devicesController);
  app.decorate("commandsController", commandsController);

  // Register TCP server plugin
  await app.register(tcpServerPlugin);

  // Register HTTP routes
  await app.register(routes);

  // Handle shutdown
  app.addHook("onClose", async (instance) => {
    app.log.info("Services shut down");
  });

  return app;
}
