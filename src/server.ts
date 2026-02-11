/**
 * Gateway Service Entry Point
 * Starts the Fastify application (HTTP + TCP servers)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local first (overrides .env for local development)
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });
// Load .env from project root
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { buildApp } from "./app";
import { FASTIFY_CONFIG } from "./config";
import 'dotenv/config';


async function start() {
  try {
    const app = await buildApp();

    // Start HTTP server
    await app.listen({
      port: FASTIFY_CONFIG.httpPort,
      host: FASTIFY_CONFIG.host,
    });

    app.log.info(
      `🌐 HTTP Server: http://${FASTIFY_CONFIG.host}:${FASTIFY_CONFIG.httpPort}`,
    );
    app.log.info(
      `🔌 TCP Server: tcp://${FASTIFY_CONFIG.host}:${FASTIFY_CONFIG.tcpPort}`,
    );
    app.log.info("✅ Gateway Service started successfully");
  } catch (err) {
    console.error(`Failed to start Gateway Service: ${err}`);
    process.exit(1);
  }
}

// Handle signals
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

start();

