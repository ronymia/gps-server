/**
 * Frame Processor for JT808 Protocol
 * Handles scanning for multiple frames in a buffer and processing them
 */

import { unescape } from "./escape";
import { calculateChecksum } from "./checksum";
import { bcdToString } from "./bcd";

export interface ProcessedFrame {
  deviceId: string;
  messageId: number;
  sequence: number;
  receivedSequence: number;
  bodyHex: string;
  responseMessageId: string | null;
  ackResult: number | null;
  ackStatus: string;
  responseSent: boolean;
  body: Buffer;
  terminalIdBuf: Buffer;
}

/**
 * Process raw incoming buffer from socket
 * Scans for 0x7E frame boundaries, unescapes, validates checksum
 * Returns array of parsed frames
 */
export function processIncomingFrames(
  buffer: Buffer,
  logger?: any,
): ProcessedFrame[] {
  const results: ProcessedFrame[] = [];
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  let i = 0;
  while (i < buf.length) {
    // Look for start flag 0x7E
    if (buf[i] !== 0x7e) {
      i++;
      continue;
    }

    // Find end flag 0x7E
    let j = i + 1;
    while (j < buf.length && buf[j] !== 0x7e) {
      j++;
    }

    if (j >= buf.length) break;

    // Extract frame (without start/end flags)
    const frame = buf.slice(i + 1, j);
    i = j + 1;

    try {
      // Unescape
      const unescaped = unescape(frame);
      if (unescaped.length < 13) {
        if (logger) logger.warn("Frame too short, skipping");
        continue;
      }

      // Extract and validate checksum
      const receivedChecksum = unescaped[unescaped.length - 1];
      const content = unescaped.slice(0, -1);
      const calc = calculateChecksum(content);

      if (calc !== receivedChecksum) {
        if (logger) {
          logger.warn(
            `⚠️ Checksum mismatch: calc=0x${calc.toString(16).padStart(2, "0")} recv=0x${receivedChecksum.toString(16).padStart(2, "0")}`,
          );
        }
        // Continue anyway, some devices may have checksum issues
      }

      // Parse header
      const msgId = content.readUInt16BE(0);
      const bodyAttr = content.readUInt16BE(2);
      const bodyLen = bodyAttr & 0x03ff; // Lower 10 bits
      const terminalIdBuf = content.slice(4, 10);
      const serialNum = content.readUInt16BE(10);
      const body = content.slice(12, 12 + bodyLen);

      const deviceId = bcdToString(terminalIdBuf);

      const resultEntry: ProcessedFrame = {
        deviceId,
        messageId: msgId,
        sequence: serialNum,
        receivedSequence: serialNum,
        bodyHex: body.toString("hex"),
        responseMessageId: null,
        ackResult: null,
        ackStatus: "Pending",
        responseSent: false,
        body,
        terminalIdBuf,
      };

      // Handle authentication body (0x0102)
      if (msgId === 0x0102) {
        if (body.length > 0) {
          try {
            const authString = body.toString("ascii");
            resultEntry.responseMessageId = authString;
          } catch {
            resultEntry.responseMessageId = body.toString("hex");
          }
        } else {
          resultEntry.responseMessageId = "Empty auth body";
          if (logger)
            logger.warn(`⚠️ Device ${deviceId} sent empty authentication body`);
        }
      }

      results.push(resultEntry);
    } catch (err: any) {
      if (logger) logger.error(`❌ Error parsing frame: ${err.message}`);
    }
  }

  return results;
}
