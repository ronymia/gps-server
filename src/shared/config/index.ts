import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

// Load environment variables
dotenvConfig();

// Validation schema
const configSchema = z.object({
  // Node
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_HOST: z.string().default("mysql"),
  DATABASE_PORT: z.string().default("3306"),
  DATABASE_NAME: z.string().default("fleet"),
  DATABASE_USER: z.string().default("fleet"),
  DATABASE_PASSWORD: z.string(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_SALT_ROUNDS: z.string().default("12"),

  // S3/MinIO
  S3_ENDPOINT: z.string().default("http://minio:9000"),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("fleet-uploads"),
  MINIO_USE_SSL: z.string().default("false"),

  // Gateway Service
  GATEWAY_TCP_PORT: z.string().default("6801"),
  GATEWAY_HTTP_PORT: z.string().default("3001"),
  GATEWAY_VIDEO_PORT: z.string().default("7001"),

  // API Service
  API_PORT: z.string().default("8000"),
  API_HOST: z.string().default("0.0.0.0"),

  // WebSocket Service
  WEBSOCKET_PORT: z.string().default("9000"),
  WEBSOCKET_HOST: z.string().default("0.0.0.0"),

  // Logging
  LOG_LEVEL: z.string().default("info"),
  LOG_PRETTY: z.string().default("true"),
});

// Parse and validate
const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const config = {
  node: {
    env: parsed.data.NODE_ENV,
    isDevelopment: parsed.data.NODE_ENV === "development",
    isProduction: parsed.data.NODE_ENV === "production",
    isTest: parsed.data.NODE_ENV === "test",
  },

  database: {
    url: parsed.data.DATABASE_URL,
    host: parsed.data.DATABASE_HOST,
    port: parseInt(parsed.data.DATABASE_PORT),
    name: parsed.data.DATABASE_NAME,
    user: parsed.data.DATABASE_USER,
    password: parsed.data.DATABASE_PASSWORD,
  },

  jwt: {
    secret: parsed.data.JWT_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: parseInt(parsed.data.BCRYPT_SALT_ROUNDS),
  },

  s3: {
    endpoint: parsed.data.S3_ENDPOINT,
    accessKey: parsed.data.S3_ACCESS_KEY,
    secretKey: parsed.data.S3_SECRET_KEY,
    region: parsed.data.S3_REGION,
    bucket: parsed.data.S3_BUCKET,
    useSSL: parsed.data.MINIO_USE_SSL === "true",
  },

  gateway: {
    tcpPort: parseInt(parsed.data.GATEWAY_TCP_PORT),
    httpPort: parseInt(parsed.data.GATEWAY_HTTP_PORT),
    videoPort: parseInt(parsed.data.GATEWAY_VIDEO_PORT),
  },

  api: {
    port: parseInt(parsed.data.API_PORT),
    host: parsed.data.API_HOST,
  },

  websocket: {
    port: parseInt(parsed.data.WEBSOCKET_PORT),
    host: parsed.data.WEBSOCKET_HOST,
  },

  logging: {
    level: parsed.data.LOG_LEVEL,
    pretty: parsed.data.LOG_PRETTY === "true",
  },
};

// Export individual configs
export const {
  node: nodeConfig,
  database: databaseConfig,
  jwt: jwtConfig,
  s3: s3Config,
  gateway: gatewayConfig,
  api: apiConfig,
  websocket: websocketConfig,
  logging: loggingConfig,
} = config;

// Export env utilities for additional flexibility
export * from "./env";
