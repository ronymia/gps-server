/**
 * Fastify configuration
 */
import { gatewayConfig, loggingConfig } from "../shared/config";

export const FASTIFY_CONFIG = {
  tcpPort: gatewayConfig.tcpPort,
  httpPort: gatewayConfig.httpPort,
  host: process.env.HOST || "0.0.0.0", // Keep fallback for flexibility
  logger: {
    level: loggingConfig.level,
  },
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
};
