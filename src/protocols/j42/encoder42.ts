/**
 * J42/JT808 Protocol Encoder
 * Builds command frames for sending to terminals
 */

import { stringToBCD } from "./utils/bcd";
import { escape } from "./utils/escape";
import { calculateChecksum } from "./utils/checksum";

/**
 * Message sequence counter
 */
let messageSequence = 0;

/**
 * Build a JT808 frame
 * @param msgId - Message ID (e.g., 0x8001, 0x8100)
 * @param terminalIdBuf - Terminal ID as 6-byte BCD buffer
 * @param body - Message body buffer
 * @param customSequence - Optional custom sequence number
 */
export function buildJT808Frame(
  msgId: number,
  terminalIdBuf: Buffer,
  body: Buffer = Buffer.alloc(0),
  customSequence: number | null = null,
): Buffer {
  // Sequence: if custom provided use it, else increment global (wrap at 0xFFFF -> 0)
  const sequence =
    customSequence !== null
      ? customSequence & 0xffff
      : (messageSequence = (messageSequence + 1) & 0xffff);

  // Header (12 bytes)
  const header = Buffer.alloc(12);
  header.writeUInt16BE(msgId & 0xffff, 0);

  // Body attributes: lower 10 bits = length
  const bodyLen = body.length & 0x03ff; // 10 bits
  header.writeUInt16BE(bodyLen, 2);

  // Terminal ID (6 bytes) - must be exactly 6 bytes BCD
  if (!Buffer.isBuffer(terminalIdBuf) || terminalIdBuf.length !== 6) {
    throw new Error("terminalIdBuf must be Buffer(6) BCD");
  }
  terminalIdBuf.copy(header, 4);

  // Sequence
  header.writeUInt16BE(sequence, 10);

  // Payload for checksum = header + body
  const payload = Buffer.concat([header, body]);

  // Checksum
  const checksum = calculateChecksum(payload);
  const payloadWithChecksum = Buffer.concat([payload, Buffer.from([checksum])]);

  // Escape payloadWithChecksum (do not escape start/end flags)
  const escaped = escape(payloadWithChecksum);

  // Final frame
  return Buffer.concat([Buffer.from([0x7e]), escaped, Buffer.from([0x7e])]);
}

/**
 * Build Set Parameters command (0x8103)
 */
export function buildSetParameters(
  deviceId: string,
  intervalSeconds: number,
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const countBuffer = Buffer.from([1]);
  const paramId = Buffer.from([0x00, 0x29]);
  const paramLength = Buffer.from([0x04]);
  const paramValue = Buffer.alloc(4);
  paramValue.writeUInt32BE(intervalSeconds, 0);
  const body = Buffer.concat([countBuffer, paramId, paramLength, paramValue]);
  return buildJT808Frame(0x8103, terminalIdBuf, body);
}

/**
 * Build Query Parameters command (0x8104)
 */
export function buildQueryParameters(
  deviceId: string,
  paramIds: number[],
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const countBuffer = Buffer.from([paramIds.length]);
  const idBuffers = paramIds.map((id) => {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(id, 0);
    return buf;
  });
  const body = Buffer.concat([countBuffer, ...idBuffers]);
  return buildJT808Frame(0x8104, terminalIdBuf, body);
}

/**
 * Build Terminal Control command (0x8105)
 */
export function buildTerminalControl(
  deviceId: string,
  command: number,
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const body = Buffer.from([command & 0xff]);
  return buildJT808Frame(0x8105, terminalIdBuf, body);
}

/**
 * Build Text Command (0x8300)
 */
export function buildTextCommand(
  deviceId: string,
  textCommand: string,
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const flag = 0x00;
  const textBuffer = Buffer.from(textCommand, "utf8");
  const body = Buffer.concat([Buffer.from([flag]), textBuffer]);
  return buildJT808Frame(0x8300, terminalIdBuf, body);
}

/**
 * Build General ACK (0x8001)
 */
export function buildGeneralACK(
  deviceId: string,
  receivedMsgId: number,
  receivedSequence: number,
  result: number = 0,
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const ackBody = Buffer.alloc(5);
  ackBody.writeUInt16BE(receivedMsgId, 0);
  ackBody.writeUInt16BE(receivedSequence, 2);
  ackBody.writeUInt8(result, 4);
  return buildJT808Frame(0x8001, terminalIdBuf, ackBody);
}

/**
 * Build Registration Response (0x8100)
 */
export function buildRegistrationResponse(
  deviceId: string,
  receivedSequence: number,
  result: number = 0,
  authCode: string = "DESN",
): Buffer {
  const terminalIdBuf = stringToBCD(deviceId);
  const authCodeBuf = Buffer.from(authCode, "ascii");
  const loginBody = Buffer.alloc(3 + authCodeBuf.length);
  loginBody.writeUInt16BE(receivedSequence, 0);
  loginBody.writeUInt8(result, 2);
  authCodeBuf.copy(loginBody, 3);
  return buildJT808Frame(0x8100, terminalIdBuf, loginBody);
}
