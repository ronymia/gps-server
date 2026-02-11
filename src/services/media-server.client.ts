/**
 * Media Server Client
 * Handles communication with the media server for JTT1078 video streams
 */

import * as net from "net";
import { EventEmitter } from "events";
import { FastifyInstance } from "fastify";

interface MediaServerConfig {
  host: string;
  port: number;
}

export class MediaServerClient extends EventEmitter {
  private config: MediaServerConfig;
  private connections: Map<string, net.Socket> = new Map();

  constructor(
    private fastify: FastifyInstance,
    config?: Partial<MediaServerConfig>,
  ) {
    super();
    this.config = {
      host: config?.host || process.env.MEDIA_SERVER_HOST || "localhost",
      port:
        config?.port ||
        parseInt(process.env.MEDIA_SERVER_JTT1078_PORT || "6802"),
    };

    this.fastify.log.info(
      `📹 Media Server Client initialized: ${this.config.host}:${this.config.port}`,
    );
  }

  /**
   * Forward JTT1078 stream to media server
   */
  forwardStream(deviceId: string, clientSocket: net.Socket): void {
    const connectionKey = `${deviceId}`;

    // Check if already forwarding
    if (this.connections.has(connectionKey)) {
      this.fastify.log.warn(
        `Stream already forwarding for device: ${deviceId}`,
      );
      return;
    }

    // Create connection to media server
    const mediaSocket = net.connect(
      {
        host: this.config.host,
        port: this.config.port,
      },
      () => {
        this.fastify.log.info(
          `🎥 Connected to media server for device: ${deviceId}`,
        );
        this.emit("connected", { deviceId });
      },
    );

    // Store connection
    this.connections.set(connectionKey, mediaSocket);

    // Forward data from client to media server
    clientSocket.on("data", (data) => {
      if (mediaSocket.writable) {
        mediaSocket.write(data);
        this.fastify.log.debug(
          `➡️  Forwarded ${data.length} bytes to media server (${deviceId})`,
        );
      }
    });

    // Forward data from media server to client
    mediaSocket.on("data", (data) => {
      if (clientSocket.writable) {
        clientSocket.write(data);
        this.fastify.log.debug(
          `⬅️  Forwarded ${data.length} bytes to client (${deviceId})`,
        );
      }
    });

    // Handle client disconnect
    clientSocket.on("close", () => {
      this.fastify.log.info(`Client disconnected: ${deviceId}`);
      mediaSocket.end();
      this.connections.delete(connectionKey);
      this.emit("client-disconnected", { deviceId });
    });

    clientSocket.on("error", (err) => {
      this.fastify.log.error(
        `Client socket error (${deviceId}): ${err.message}`,
      );
      mediaSocket.end();
      this.connections.delete(connectionKey);
    });

    // Handle media server disconnect
    mediaSocket.on("close", () => {
      this.fastify.log.info(`Media server disconnected: ${deviceId}`);
      this.connections.delete(connectionKey);
      this.emit("media-server-disconnected", { deviceId });
    });

    mediaSocket.on("error", (err) => {
      this.fastify.log.error(
        `Media server socket error (${deviceId}): ${err.message}`,
      );
      clientSocket.end();
      this.connections.delete(connectionKey);
    });
  }

  /**
   * Stop forwarding stream for a device
   */
  stopStream(deviceId: string): void {
    const connectionKey = `${deviceId}`;
    const socket = this.connections.get(connectionKey);

    if (socket) {
      socket.end();
      this.connections.delete(connectionKey);
      this.fastify.log.info(
        `Stopped forwarding stream for device: ${deviceId}`,
      );
      this.emit("stream-stopped", { deviceId });
    }
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.connections.size;
  }

  /**
   * Get list of active device IDs
   */
  getActiveDevices(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if device stream is active
   */
  isStreamActive(deviceId: string): boolean {
    return this.connections.has(deviceId);
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    this.fastify.log.info("Cleaning up media server connections...");
    this.connections.forEach((socket, deviceId) => {
      socket.end();
    });
    this.connections.clear();
  }
}
