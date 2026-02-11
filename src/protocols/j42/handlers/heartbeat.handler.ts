/**
 * Heartbeat handler for J42/JT808 protocol
 * Handles heartbeat messages (0x0002) and terminal general responses (0x0001)
 */

/**
 * Parse heartbeat request (typically empty body)
 */
export function parseHeartbeat(bodyHex: string): any {
  return {
    messageType: "heartbeat",
    timestamp: new Date().toISOString(),
    bodyLength: bodyHex.length / 2,
  };
}

/**
 * Parse terminal general response (0x0002)
 */
export function parseTerminalResponse(bodyHex: string): any {
  const data: any = {};

  if (bodyHex.length >= 10) {
    // Response Sequence Number (2 bytes)
    data.receivedSequence = parseInt(bodyHex.substring(0, 4), 16);

    // Response Message ID (2 bytes)
    data.responseMessageId = bodyHex.substring(4, 8);

    // Result (1 byte)
    data.ackResult = parseInt(bodyHex.substring(8, 10), 16);
    data.ackStatus = getAckStatusDescription(data.ackResult);
  } else {
    data.error = "ACK body too short";
    data.rawPayload = bodyHex;
  }

  return data;
}

/**
 * Get ACK status description
 */
function getAckStatusDescription(result: number): string {
  const statuses: Record<number, string> = {
    0: "Success/Acknowledged",
    1: "Failure",
    2: "Message Error",
    3: "Not Supported",
    4: "Alarm Processed",
  };
  return statuses[result] || `Unknown (${result})`;
}

/**
 * Create heartbeat ACK response
 */
export function createHeartbeatResponse(
  deviceId: string,
  sequence: number,
): any {
  return {
    messageId: 0x8001,
    deviceId,
    sequence,
    result: 0,
    resultDescription: "Heartbeat Acknowledged",
  };
}
