/**
 * Response Logger Controller
 * Provides API endpoints to view server responses (ACKs, etc.)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ResponseLoggerService } from "../services/response-logger.service";

export default async function responseLoggerController(
  fastify: FastifyInstance,
  opts: any,
) {
  /**
   * GET /responses - Get recent server responses
   */
  fastify.get(
    "/responses",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 10,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              count: { type: "number" },
              responses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    deviceId: { type: "string" },
                    messageType: { type: "string" },
                    responseHex: { type: "string" },
                    requestHex: { type: "string" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { limit?: number } }>,
      reply: FastifyReply,
    ) => {
      const { limit = 10 } = request.query;
      const responseLogger: ResponseLoggerService = (fastify as any)
        .responseLogger;

      const responses = responseLogger.getServerResponses(limit);

      return reply.send({
        success: true,
        count: responses.length,
        responses,
      });
    },
  );

  /**
   * GET /responses/:deviceId - Get responses for a specific device
   */
  fastify.get(
    "/responses/:deviceId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            deviceId: { type: "string" },
          },
          required: ["deviceId"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 10,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              deviceId: { type: "string" },
              count: { type: "number" },
              responses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    deviceId: { type: "string" },
                    messageType: { type: "string" },
                    responseHex: { type: "string" },
                    requestHex: { type: "string" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { deviceId: string };
        Querystring: { limit?: number };
      }>,
      reply: FastifyReply,
    ) => {
      const { deviceId } = request.params;
      const { limit = 10 } = request.query;
      const responseLogger: ResponseLoggerService = (fastify as any)
        .responseLogger;

      const responses = responseLogger.getDeviceResponses(deviceId, limit);

      return reply.send({
        success: true,
        deviceId,
        count: responses.length,
        responses,
      });
    },
  );

  /**
   * GET /responses/stats - Get response statistics
   */
  fastify.get(
    "/responses/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              totalResponses: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const responseLogger: ResponseLoggerService = (fastify as any)
        .responseLogger;

      return reply.send({
        success: true,
        totalResponses: responseLogger.getCount(),
      });
    },
  );
}
