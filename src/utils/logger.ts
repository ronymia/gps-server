/**
 * Logger Utility
 * Centralized logger instance using pino
 */

import pino from "pino";

// Create pino instance
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

export default logger;
