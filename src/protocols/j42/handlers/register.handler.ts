/**
 * Registration handler for J42/JT808 protocol
 * Handles terminal registration (0x0100) and registration response (0x8100)
 */

/**
 * Parse registration request from terminal
 */
export function parseRegistrationRequest(bodyHex: string): any {
  // JT808 registration format:
  // Province ID (2 bytes) + City ID (2 bytes) + Manufacturer ID (5 bytes) +
  // Terminal Model (20 bytes) + Terminal ID (7 bytes) + License Plate Color + License Plate Number

  let pos = 0;
  const data: any = {};

  if (bodyHex.length < 4) {
    return { error: "Registration body too short" };
  }

  // Province ID (2 bytes)
  data.provinceId = parseInt(bodyHex.substring(pos, pos + 4), 16);
  pos += 4;

  // City ID (2 bytes)
  if (pos + 4 <= bodyHex.length) {
    data.cityId = parseInt(bodyHex.substring(pos, pos + 4), 16);
    pos += 4;
  }

  // Manufacturer ID (5 bytes)
  if (pos + 10 <= bodyHex.length) {
    data.manufacturerId = Buffer.from(bodyHex.substring(pos, pos + 10), "hex")
      .toString("ascii")
      .trim();
    pos += 10;
  }

  // Terminal Model (20 bytes)
  if (pos + 40 <= bodyHex.length) {
    data.terminalModel = Buffer.from(bodyHex.substring(pos, pos + 40), "hex")
      .toString("ascii")
      .trim();
    pos += 40;
  }

  // Terminal ID (7 bytes)
  if (pos + 14 <= bodyHex.length) {
    data.terminalId = Buffer.from(bodyHex.substring(pos, pos + 14), "hex")
      .toString("ascii")
      .trim();
    pos += 14;
  }

  // License Plate Color (1 byte)
  if (pos + 2 <= bodyHex.length) {
    data.plateColor = parseInt(bodyHex.substring(pos, pos + 2), 16);
    pos += 2;
  }

  // License Plate (remainder)
  if (pos < bodyHex.length) {
    const plateHex = bodyHex.substring(pos);
    data.plateNumber = Buffer.from(plateHex, "hex").toString("utf8").trim();
  }

  return data;
}

/**
 * Create registration response
 */
export function createRegistrationResponse(
  deviceId: string,
  sequence: number,
  result: number = 0,
  authCode: string = "DESN",
): any {
  return {
    messageId: 0x8100,
    deviceId,
    sequence,
    result, // 0 = success, 1 = vehicle registered, 2 = no such vehicle, 3 = terminal registered, 4 = no such terminal
    authCode: result === 0 ? authCode : "",
    resultDescription: getRegistrationResultDescription(result),
  };
}

/**
 * Get registration result description
 */
function getRegistrationResultDescription(result: number): string {
  const descriptions: Record<number, string> = {
    0: "Registration Successful",
    1: "Vehicle Already Registered",
    2: "No Such Vehicle in Database",
    3: "Terminal Already Registered",
    4: "No Such Terminal in Database",
  };
  return descriptions[result] || `Unknown Result (${result})`;
}
