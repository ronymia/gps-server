/**
 * TCP Server Plugin for Fastify
 * Handles TCP connections for device protocols (J42, JTT808, JTT1078)
 */

import fp from "fastify-plugin";
import * as net from "net";
import { FastifyInstance } from "fastify";
import { FASTIFY_CONFIG } from "../config";
import dayjs from "dayjs";
import { processIncomingFrames } from "../protocols/j42/utils/frame-processor";
import {
  buildGeneralACK,
  buildRegistrationResponse,
} from "../protocols/j42/encoder42";
import { ResponseLoggerService } from "../services/response-logger.service";
import { MediaServerClient } from "../services/media-server.client";

export default fp(
  async function tcpServerPlugin(fastify: FastifyInstance, opts: any) {
    const { packetService, deviceService, decoderService } = fastify;

    // Initialize response logger
    const responseLogger = new ResponseLoggerService(fastify.log);
    fastify.decorate("responseLogger", responseLogger);

    // Initialize media server client
    const mediaServerClient = new MediaServerClient(fastify);
    fastify.decorate("mediaServerClient", mediaServerClient);

    // Log media server events
    mediaServerClient.on("connected", ({ deviceId }) => {
      fastify.log.info(`🎥 Media server stream started: ${deviceId}`);
    });

    mediaServerClient.on("stream-stopped", ({ deviceId }) => {
      fastify.log.info(`⏹️  Media server stream stopped: ${deviceId}`);
    });

    // Create TCP server
    const tcpServer = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      fastify.log.info(`✅ New TCP connection: ${clientId}`);

      let isJTT1078Stream = false;
      let deviceIdForStream: string | null = null;

      socket.on("data", async (data) => {
        try {
          // Detect protocol first
          const protocol = decoderService.detectProtocol(data);

          // Handle JTT1078 video streams - forward to media server
          if (protocol === "jtt1078") {
            fastify.log.info(
              `📹 JTT1078 video stream detected from ${clientId}`,
            );

            if (!isJTT1078Stream) {
              isJTT1078Stream = true;

              // Try to extract device ID from packet
              if (data.length >= 12) {
                // Parse device ID from JTT1078 header (BCD format, 6 bytes at offset 5)
                let simNo = "";
                for (let i = 0; i < 6; i++) {
                  const byte = data[5 + i];
                  const high = (byte >> 4) & 0x0f;
                  const low = byte & 0x0f;
                  simNo += high.toString() + low.toString();
                }
                deviceIdForStream = simNo;
              }

              // Forward entire connection to media server
              mediaServerClient.forwardStream(
                deviceIdForStream || clientId,
                socket,
              );
            }

            // Don't process JTT1078 in gateway anymore - it's forwarded
            return;
          }

          // Handle JTT808 and J42 protocols normally
          fastify.log.info(`📥 Data from ${clientId}: ${data.length} bytes`);
          fastify.log.debug({ rowData: data.toString("hex") });

          // Process all frames in buffer (handles multiple frames)
          const frames = processIncomingFrames(data, fastify.log);

          for (const frame of frames) {
            try {
              // Detect protocol and decode
              const protocol = decoderService.detectProtocol(data);
              const parsed = decoderService.decode(data, protocol);

              // Add metadata
              const packetEntry = {
                ...parsed,
                receivedAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                raw: data.toString("hex"),
                source: "TCP",
                clientId,
                protocol,
              };

              // Store packet (now async - saves to DB)
              await packetService.store(packetEntry);

              // Update device connection
              if (parsed.deviceId) {
                deviceService.register(parsed.deviceId, {
                  socket,
                  clientId,
                  protocol,
                  type: "tcp",
                });

                fastify.log.info(
                  `🔗 Device ${parsed.deviceId} registered (${protocol})`,
                );
              }

              // Send appropriate responses based on message type
              const deviceId = frame.deviceId;
              const msgId = frame.messageId;
              const serialNum = frame.sequence;
              const terminalIdBuf = frame.terminalIdBuf;

              // Build frame for logging
              const requestFrameHex = data.toString("hex");

              if (msgId === 0x0100) {
                // Registration: Send 0x8100 response first, then 0x8001 ACK
                const resultCode = 0x00; // Success
                const authCode = "DESN";

                // 1. Send 0x8100 Registration Response
                const loginFrame = buildRegistrationResponse(
                  deviceId,
                  serialNum,
                  resultCode,
                  authCode,
                );
                socket.write(loginFrame);

                responseLogger.logServerResponse(
                  deviceId,
                  "Login Response 0x8100",
                  loginFrame.toString("hex"),
                  requestFrameHex,
                );

                fastify.log.info(
                  `📤 Sent 0x8100 Registration Response to ${deviceId}`,
                );

                // Log ACK
                packetService.logAck(deviceId, {
                  messageType: "0x8100 (Registration Response)",
                  rawHex: loginFrame.toString("hex"),
                  relatedRequestHex: requestFrameHex,
                });

                // 2. Send 0x8001 ACK for registration
                const ackFrame = buildGeneralACK(
                  deviceId,
                  msgId,
                  serialNum,
                  0x00,
                );
                socket.write(ackFrame);

                responseLogger.logServerResponse(
                  deviceId,
                  `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                  ackFrame.toString("hex"),
                  requestFrameHex,
                );

                fastify.log.info(`📤 Sent 0x8001 ACK to ${deviceId}`);

                packetService.logAck(deviceId, {
                  messageType: "0x8001 (General ACK)",
                  rawHex: ackFrame.toString("hex"),
                  relatedRequestHex: requestFrameHex,
                  description: `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                });
              } else if (msgId === 0x0102) {
                // Authentication: Send 0x8001 ACK only
                const ackFrame = buildGeneralACK(
                  deviceId,
                  msgId,
                  serialNum,
                  0x00,
                );
                socket.write(ackFrame);

                responseLogger.logServerResponse(
                  deviceId,
                  `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                  ackFrame.toString("hex"),
                  requestFrameHex,
                );

                fastify.log.info(
                  `📤 Sent 0x8001 ACK for Authentication to ${deviceId}`,
                );

                packetService.logAck(deviceId, {
                  messageType: "0x8001 (Authentication ACK)",
                  rawHex: ackFrame.toString("hex"),
                  relatedRequestHex: requestFrameHex,
                  description: `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                });
              } else {
                // Other messages: Send 0x8001 ACK
                const ackFrame = buildGeneralACK(
                  deviceId,
                  msgId,
                  serialNum,
                  0x00,
                );
                socket.write(ackFrame);

                responseLogger.logServerResponse(
                  deviceId,
                  `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                  ackFrame.toString("hex"),
                  requestFrameHex,
                );

                fastify.log.info(
                  `📤 Sent 0x8001 ACK for 0x${msgId.toString(16).padStart(4, "0")} to ${deviceId}`,
                );

                packetService.logAck(deviceId, {
                  messageType: "0x8001 (General ACK)",
                  rawHex: ackFrame.toString("hex"),
                  relatedRequestHex: requestFrameHex,
                  description: `ACK for 0x${msgId.toString(16).padStart(4, "0")}`,
                });
              }

              fastify.log.info(
                `📊 Processed ${parsed.messageType || "unknown"} from ${parsed.deviceId || "unknown"}`,
              );
            } catch (frameError: any) {
              fastify.log.error(
                `❌ Frame processing error: ${frameError.message}`,
              );
            }
          }
        } catch (error: any) {
          fastify.log.error(`❌ TCP processing error: ${error.message}`);
        }
      });

      socket.on("error", (err) => {
        fastify.log.error(`❌ Socket error ${clientId}: ${err.message}`);
      });

      socket.on("close", () => {
        fastify.log.info(`👋 Connection closed: ${clientId}`);
        const deviceId = deviceService.removeBySocket(socket);
        if (deviceId) {
          fastify.log.info(`🗑️  Device ${deviceId} disconnected`);
        }
      });
    });

    // Start TCP server
    tcpServer.listen(FASTIFY_CONFIG.tcpPort, FASTIFY_CONFIG.host, () => {
      fastify.log.info(
        `🚀 TCP Server listening on ${FASTIFY_CONFIG.host}:${FASTIFY_CONFIG.tcpPort}`,
      );
    });

    // Decorate fastify with TCP server and response logger for shutdown/access
    fastify.decorate("tcpServer", tcpServer);

    // Handle shutdown
    fastify.addHook("onClose", async () => {
      return new Promise<void>((resolve) => {
        tcpServer.close(() => {
          fastify.log.info("TCP server closed");
          resolve();
        });
      });
    });
  },
  {
    name: "tcp-server",
  },
);
