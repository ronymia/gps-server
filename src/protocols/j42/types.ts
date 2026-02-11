/**
 * J42/JT808 Protocol Type Definitions
 * Comprehensive type system for GPS tracking protocol
 */

import { Socket } from "net";

// ============================================================================
// CORE PROTOCOL TYPES
// ============================================================================

export type ProtocolType = "JT808" | "J42 SMS" | "Unknown";
export type ConnectionType = "tcp" | "udp";
export type Hemisphere = "North" | "South" | "East" | "West";

// ============================================================================
// DEVICE & CONNECTION
// ============================================================================

export interface DeviceConnection {
  type: ConnectionType;
  socket?: Socket;
  address: string;
  port: number;
  lastSeen: Date;
}

export interface DeviceInfo {
  deviceId: string;
  imei?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
}

// ============================================================================
// PACKET STRUCTURES
// ============================================================================

export interface RawPacket {
  hex: string;
  ascii: string;
  buffer: Buffer;
  timestamp: string;
  deviceId?: string;
  source: ConnectionType;
  remoteAddress?: string;
  remotePort?: number;
}

export interface PacketHeader {
  messageId: number;
  messageIdHex: string;
  messageType: string;
  bodyProperties: number;
  bodyLength: number;
  encrypted: boolean;
  fragmented: boolean;
  deviceId: string;
  deviceIdBCD: string;
  sequence: number;
}

export interface LocationData {
  alarmFlag: number;
  statusFlag: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  direction: number;
  timestamp: string;
  located: boolean;
}

export interface ExtensionField {
  tag: number;
  tagHex: string;
  length: number;
  value: string;
  parsed?: any;
  description?: string;
}

export interface Extensions {
  mileage?: number;
  fuelLevel?: number;
  speed?: number;
  batteryVoltage?: number;
  signalStrength?: number;
  satellites?: number;
  rssi?: number;
  cellTowerInfo?: CellTowerInfo;
  nestedParameters?: NestedParameter[];
  raw?: ExtensionField[];
}

export interface CellTowerInfo {
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: number;
  signalStrength?: number;
  batteryVoltage?: number;
  raw?: string;
}

export interface NestedParameter {
  id: number;
  idHex: string;
  length: number;
  value: string;
  description?: string;
}

// ============================================================================
// ALARM & STATUS FLAGS
// ============================================================================

export interface AlarmDetails {
  flag: number;
  flagHex: string;
  flagBinary: string;
  active: string[];
  count: number;
  severity: "none" | "low" | "medium" | "high" | "critical";
  protocol: string;
  details: AlarmDetail[];
  isCritical: boolean;
}

export interface AlarmDetail {
  bit: number;
  active: boolean;
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  protocolSpecific?: string;
}

export interface StatusDetails {
  flag: number;
  flagHex: string;
  flagBinary: string;
  details: StatusDetail[];
  summary: {
    accOn: boolean;
    located: boolean;
    hemisphere: string;
    operating: string;
    oilCircuit: string;
    circuit: string;
    doorLocked: boolean;
  };
}

export interface StatusDetail {
  bits: string;
  value: string;
  name: string;
  description: string;
}

// ============================================================================
// PARSED PACKET
// ============================================================================

export interface ParsedPacket {
  protocol: ProtocolType;
  deviceId: string;
  timestamp: string;
  messageType?: string;
  messageId?: number;
  sequence?: number;

  // Header information
  header?: PacketHeader;

  // Location data
  location?: LocationData;

  // Alarms and status
  alarmFlag?: number;
  alarmInfo?: string[];
  alarmDetails?: AlarmDetails;
  statusFlag?: number;
  statusInfo?: any;
  statusDetails?: StatusDetails;

  // Extensions
  extensions?: Extensions;

  // Cell tower and signal
  cellTower?: CellTowerInfo;
  signalQuality?: string;
  gpsFixQuality?: string;
  satellites?: number;

  // Battery and power
  batteryVoltage?: number;
  batteryStatus?: string;

  // Raw data
  raw?: {
    hex: string;
    ascii: string;
  };

  // Detailed breakdown
  breakdown?: PacketBreakdown;
}

export interface PacketBreakdown {
  protocol: string;
  rawHex: string;
  totalLength: number;

  frame: {
    startFlag: string;
    endFlag: string;
    checksum: string;
    checksumValid: boolean;
  };

  header: PacketHeader;

  body: {
    hex: string;
    length: number;
    location?: LocationData;
    extensions?: ExtensionField[];
  };

  parsing: {
    timestamp: string;
    parseTimeMs?: number;
  };
}

// ============================================================================
// JT808 SPECIFIC TYPES
// ============================================================================

export interface JT808Frame {
  startFlag: number; // 0x7E
  messageId: number;
  bodyProperties: number;
  deviceIdBCD: Buffer;
  sequence: number;
  body: Buffer;
  checksum: number;
  endFlag: number; // 0x7E
}

export interface JT808Response {
  responseHex: string;
  messageType: string;
  deviceId: string;
  timestamp: string;
  responseSent: boolean;
  responseLog?: string;
}

export interface ServerResponse {
  timestamp: string;
  deviceId: string;
  messageType: string;
  responseHex: string;
  requestHex: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiQuery {
  device?: string;
  limit?: string | number;
  offset?: string | number;
  since?: string;
  format?: "json" | "csv";
  haslocation?: string | boolean;
  hasalarm?: string | boolean;
  protocol?: string;
  sortby?: "time" | "device" | "protocol";
  order?: "asc" | "desc";
}

export interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  count?: number;
  data?: T;
  packets?: T[];
  statistics?: Statistics;
  error?: string;
}

export interface Statistics {
  totalPackets: number;
  uniqueDevices: number;
  packetsWithLocation?: number;
  packetsWithAlarms?: number;
  deviceBreakdown?: Record<string, number>;
  protocolBreakdown?: Record<string, number>;
  messageTypes?: Record<string, number>;
  timeRange?: {
    oldest: string;
    newest: string;
  };
}

export interface CommandRequest {
  deviceId: string;
  command: "setInterval" | "queryParameters" | "terminalControl" | "sendText";
  params?: {
    intervalSeconds?: number;
    paramIds?: number[];
    controlCommand?: number;
    text?: string;
  };
}

export interface CommandResponse {
  status: "success" | "error";
  message: string;
  commandHex?: string;
  sentVia?: ConnectionType;
  error?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface PortConfig {
  GPS_SERVER_PORT: number;
  API_SERVER_PORT: number;
  WS_SERVER_PORT: number;
  WEB_PORT: number;
  isProduction: boolean;
  isDevelopment: boolean;
  getApiPort(): number;
  getGpsPort(): number;
  getAllPorts(): AllPorts;
  printConfig(): void;
}

export interface AllPorts {
  gpsServer: number;
  apiServer: number;
  webSocket: number;
  webInterface: number;
  environment: string;
}

// ============================================================================
// PARSER OPTIONS & RESULTS
// ============================================================================

export interface ParseOptions {
  detailed?: boolean;
  includeBreakdown?: boolean;
  validateChecksum?: boolean;
}

export interface ParseResult {
  success: boolean;
  parsed?: ParsedPacket;
  error?: string;
  rawHex?: string;
}

// ============================================================================
// TIME & DATE TYPES
// ============================================================================

export interface BCDTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  formatted: string;
  timestamp: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
}

export type LogFunction = (message: string, data?: any) => void;

// ============================================================================
// SOCKET TYPES
// ============================================================================

export interface UDPSocket {
  write(data: Buffer): void;
  address: string;
  port: number;
}

export interface TCPSocket extends Socket {
  // Extends Node.js Socket type
}

export type GenericSocket = UDPSocket | TCPSocket;

// ============================================================================
// MESSAGE TYPE ENUMS
// ============================================================================

export enum MessageType {
  GENERAL_RESPONSE = 0x0001,
  HEARTBEAT = 0x0002,
  TERMINAL_REGISTRATION = 0x0100,
  TERMINAL_AUTH = 0x0102,
  UNREGISTER = 0x0003,
  LOCATION_REPORT = 0x0200,
  GENERAL_ACK = 0x8001,
  REGISTRATION_RESPONSE = 0x8100,
  SET_PARAMETERS = 0x8103,
  QUERY_PARAMETERS = 0x8104,
  TERMINAL_CONTROL = 0x8105,
  QUERY_PARAMETERS_RESPONSE = 0x8106,
  TEXT_MESSAGE = 0x8300,
}

// ============================================================================
// ALARM BIT DEFINITIONS
// ============================================================================

export enum J42AlarmBit {
  EMERGENCY = 0,
  OVERSPEED = 1,
  FATIGUE_DRIVING = 2,
  DANGER_WARNING = 3,
  GNSS_FAILURE = 4,
  GNSS_ANTENNA_DISCONNECT = 5,
  GNSS_ANTENNA_SHORT = 6,
  MAIN_POWER_UNDERVOLTAGE = 7,
  MAIN_POWER_LOSS = 8, // J42-specific
  LCD_FAULT = 9,
  TTS_FAULT = 10,
  CAMERA_FAULT = 11,
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isJ42Device(deviceId: string): boolean {
  const j42Patterns = [/^01409/, /^86/];
  return j42Patterns.some((pattern) => pattern.test(deviceId));
}

export function isParsedPacket(obj: any): obj is ParsedPacket {
  return (
    obj && typeof obj === "object" && "protocol" in obj && "deviceId" in obj
  );
}

export function isLocationData(obj: any): obj is LocationData {
  return (
    obj && typeof obj === "object" && "latitude" in obj && "longitude" in obj
  );
}
