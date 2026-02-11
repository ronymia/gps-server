/**
 * Commands Controller
 * Handles sending commands to devices
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { DeviceService } from "../services/device.service";
import {
  buildGeneralACK,
  buildSetParameters,
  buildTextCommand,
} from "../protocols/j42/encoder42";
import { stringToBCD } from "../protocols/j42/utils/bcd";

export class CommandsController {
  constructor(private deviceService: DeviceService) {}

  /**
   * POST /api/commands
   * Send command to device
   */
  async send(
    request: FastifyRequest<{
      Body: {
        deviceId: string;
        commandType: string;
        parameters?: any;
      };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const { deviceId, commandType, parameters = {} } = request.body;

      // Check if device is connected
      const connection = this.deviceService.get(deviceId);
      if (!connection) {
        return reply.status(404).send({
          success: false,
          error: "Device not connected",
        });
      }

      let commandBuffer: Buffer;

      // Build command based on type
      switch (commandType) {
        case "setInterval":
          commandBuffer = buildSetParameters(
            deviceId,
            parameters.intervalSeconds || 60,
          );
          break;

        case "textCommand":
          commandBuffer = buildTextCommand(deviceId, parameters.text || "");
          break;

        default:
          return reply.status(400).send({
            success: false,
            error: `Unknown command type: ${commandType}`,
          });
      }

      // Send command to device
      connection.socket.write(commandBuffer);

      return {
        success: true,
        data: {
          deviceId,
          commandType,
          parameters,
          sentAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
