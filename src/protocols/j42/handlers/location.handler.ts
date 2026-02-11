/**
 * Location data handler for J42/JT808 protocol
 * Handles parsing of location reports (0x0200), extensions, and cell tower info
 */

import {
  parseBCDTimeComponents,
  isJ42Device,
  getGPSFixQuality,
  getAccurateSignalQuality,
} from "../utils/parser";

/**
 * Parse alarm flags from J42/JT808 packet (simple version)
 */
export function parseAlarmFlags(
  alarmFlag: number,
  isJ42: boolean = false,
): string[] {
  const alarms: string[] = [];

  if (alarmFlag === 0) {
    return ["Normal"];
  }

  // Standard JT808 alarm flags
  if (alarmFlag & (1 << 0)) alarms.push("Emergency Alarm");
  if (alarmFlag & (1 << 1)) alarms.push("Overspeed");
  if (alarmFlag & (1 << 2)) alarms.push("Fatigue Driving");
  if (alarmFlag & (1 << 3)) alarms.push("Danger Warning");
  if (alarmFlag & (1 << 4)) alarms.push("GNSS Failure");
  if (alarmFlag & (1 << 5)) alarms.push("GNSS Antenna Disconnect");
  if (alarmFlag & (1 << 6)) alarms.push("GNSS Antenna Short");
  if (alarmFlag & (1 << 7)) alarms.push("Main Power Under-voltage");
  if (alarmFlag & (1 << 8))
    alarms.push(isJ42 ? "Main Power Loss" : "Main Power Disconnect");
  if (alarmFlag & (1 << 9)) alarms.push("LCD Fault");
  if (alarmFlag & (1 << 10)) alarms.push("TTS Fault");
  if (alarmFlag & (1 << 11)) alarms.push("Camera Fault");
  if (alarmFlag & (1 << 18)) alarms.push("Cumulative Driving Timeout");
  if (alarmFlag & (1 << 19)) alarms.push("Parking Overtime");
  if (alarmFlag & (1 << 26)) alarms.push("Vehicle Stolen");
  if (alarmFlag & (1 << 27)) alarms.push("Illegal Ignition");
  if (alarmFlag & (1 << 29)) alarms.push("Collision Warning");
  if (alarmFlag & (1 << 30)) alarms.push("Rollover Warning");
  if (alarmFlag & (1 << 31)) alarms.push("Illegal Door Open");

  return alarms.length > 0 ? alarms : ["Unknown Alarm"];
}

/**
 * Parse alarm flags with detailed breakdown (like packet-parser.js)
 */
export function parseAlarmFlagsDetailed(
  flag: number,
  isJ42Device: boolean = false,
): any {
  const alarms: any = {
    bits: {},
    descriptions: [],
    hex: flag.toString(16).padStart(8, "0").toUpperCase(),
    binary: flag.toString(2).padStart(32, "0"),
    protocol: isJ42Device ? "J42 Extended" : "JT808 Standard",
  };

  const j42AlarmDefinitions: Record<number, string> = {
    0: "Emergency Alarm (triggered by alarm switch)",
    1: "Over Speed Alarm",
    2: "Fatigue Driving",
    3: "Danger Warning",
    4: "GNSS Module Fault",
    5: "GNSS Antenna Disconnected or Cut",
    6: "GNSS Antenna Short Circuit",
    7: "Terminal Main Power Undervoltage",
    8: "Terminal Main Power Loss",
    9: "Terminal LCD or Display Fault",
    10: "TTS Module Fault",
    11: "Camera Fault",
    12: "Road Transport Certificate IC Card Module Fault",
    13: "Over Speed Warning",
    14: "Fatigue Driving Warning",
    18: "Daily Cumulative Driving Overtime",
    19: "Overtime Parking",
    20: "Enter/Exit Area",
    21: "Enter/Exit Route",
    22: "Insufficient/Excessive Road Segment Travel Time",
    23: "Route Deviation Alarm",
    24: "Vehicle VSS Fault",
    25: "Abnormal Vehicle Fuel Level",
    26: "Vehicle Stolen (via anti-theft device)",
    27: "Illegal Vehicle Ignition",
    28: "Illegal Vehicle Movement",
    29: "Collision Warning",
    30: "Rollover Warning",
    31: "Illegal Door Open Alarm",
  };

  const jt808AlarmDefinitions: Record<number, string> = {
    0: "Reserved",
    1: "Over Speed Alarm (Default 120km/h)",
    2: "Tired Alarm (Fatigue Driving)",
    7: "Low Power",
    8: "Remove Alarm (Anti-Tamper)",
    15: "Motion Alarm",
    29: "Crash Alarm",
  };

  const definitions = isJ42Device ? j42AlarmDefinitions : jt808AlarmDefinitions;

  // Check each bit
  for (let i = 0; i < 32; i++) {
    const bitValue = (flag >> i) & 1;
    if (bitValue === 1) {
      const description = definitions[i] || `Reserved (bit ${i})`;
      alarms.bits[`bit${i}`] = {
        value: 1,
        active: true,
        description: description,
      };
      alarms.descriptions.push(description);
    } else {
      alarms.bits[`bit${i}`] = {
        value: 0,
        active: false,
        description: definitions[i] || `Reserved (bit ${i})`,
      };
    }
  }

  // Add critical alarm detection
  alarms.hasCriticalAlarm = false;
  alarms.criticalAlarms = [];

  const criticalBits = isJ42Device
    ? [0, 4, 5, 6, 8, 26, 27, 31]
    : [0, 7, 8, 15, 29];

  criticalBits.forEach((bit) => {
    if ((flag >> bit) & 1) {
      alarms.hasCriticalAlarm = true;
      alarms.criticalAlarms.push(definitions[bit] || `Critical bit ${bit}`);
    }
  });

  if (alarms.descriptions.length === 0) {
    alarms.descriptions.push("Normal (No Alarms)");
    alarms.status = "NORMAL";
  } else {
    alarms.status = "ALARM";
    alarms.severity = alarms.hasCriticalAlarm ? "CRITICAL" : "WARNING";
  }

  return alarms;
}

/**
 * Parse status flags with detailed breakdown (enhanced like packet-parser.js)
 */
export function parseStatusFlags(statusFlag: number): any {
  return {
    accOn: !!(statusFlag & (1 << 0)),
    located: !!(statusFlag & (1 << 1)),
    isSouth: !!(statusFlag & (1 << 2)),
    isWest: !!(statusFlag & (1 << 3)),
    operating: statusFlag & (1 << 4) ? "Stopped" : "Running",
    encrypted: !!(statusFlag & (1 << 10)),
    oilCircuit: statusFlag & (1 << 11) ? "Disconnected" : "Normal",
    circuit: statusFlag & (1 << 12) ? "Disconnected" : "Normal",
    doorLocked: !!(statusFlag & (1 << 13)),
    door1Open: !!(statusFlag & (1 << 14)),
    door2Open: !!(statusFlag & (1 << 15)),
    door3Open: !!(statusFlag & (1 << 16)),
    door4Open: !!(statusFlag & (1 << 17)),
    door5Open: !!(statusFlag & (1 << 18)),
    gpsOn: !!(statusFlag & (1 << 19)),
    beidouOn: !!(statusFlag & (1 << 20)),
    glonassOn: !!(statusFlag & (1 << 21)),
    galileoOn: !!(statusFlag & (1 << 22)),
  };
}

/**
 * Parse status flags detailed version (like packet-parser.js)
 */
export function parseStatusFlagsDetailed(flag: number): any {
  const status: any = {
    accOn: !!(flag & 0x0001),
    located: !!(flag & 0x0002),
    isSouth: !!(flag & 0x0004),
    isWest: !!(flag & 0x0008),
    operation: !!(flag & 0x0010),
    encrypted: !!(flag & 0x0020),

    bits: {
      bit0: {
        value: flag & 0x0001 ? 1 : 0,
        description: "ACC ON",
        state: flag & 0x0001 ? "ON" : "OFF",
      },
      bit1: {
        value: flag & 0x0002 ? 1 : 0,
        description: "GPS Position Fix",
        state: flag & 0x0002 ? "FIXED" : "NO FIX",
      },
      bit2: {
        value: flag & 0x0004 ? 1 : 0,
        description: "Latitude Direction",
        state: flag & 0x0004 ? "SOUTH" : "NORTH",
      },
      bit3: {
        value: flag & 0x0008 ? 1 : 0,
        description: "Longitude Direction",
        state: flag & 0x0008 ? "WEST" : "EAST",
      },
      bit4: {
        value: flag & 0x0010 ? 1 : 0,
        description: "Operation Status",
        state: flag & 0x0010 ? "OPERATIONAL" : "INOPERATIONAL",
      },
      bit5: {
        value: flag & 0x0020 ? 1 : 0,
        description: "Encryption",
        state: flag & 0x0020 ? "ENCRYPTED" : "NOT ENCRYPTED",
      },
    },

    binary: flag.toString(2).padStart(32, "0"),
    hex: flag.toString(16).padStart(8, "0").toUpperCase(),
  };

  return status;
}

/**
 * Parse location data fields from JT808 packet body
 */
export function parseLocationData(
  bodyHex: string,
  deviceId: string,
  logger?: any,
): any {
  const data: any = {};

  try {
    let pos = 0;

    // Validate minimum length (28 bytes = 56 hex chars)
    if (bodyHex.length < 56) {
      throw new Error(
        `Location body too short: ${bodyHex.length} chars (need 56+)`,
      );
    }

    // 1. Alarm Flag (4 bytes)
    data.alarmFlag = parseInt(bodyHex.substring(pos, pos + 8), 16);
    data.alarmFlagHex = bodyHex.substring(pos, pos + 8);
    const isJ42 = isJ42Device(deviceId);
    data.alarmInfo = parseAlarmFlags(data.alarmFlag, isJ42);
    data.alarmDetails = parseAlarmFlagsDetailed(data.alarmFlag, isJ42);
    pos += 8;

    // 2. Status Flag (4 bytes)
    data.statusFlag = parseInt(bodyHex.substring(pos, pos + 8), 16);
    data.statusFlagHex = bodyHex.substring(pos, pos + 8);
    data.statusDetails = parseStatusFlags(data.statusFlag);
    data.statusDetailsExtended = parseStatusFlagsDetailed(data.statusFlag);
    pos += 8;

    // 3. Latitude (4 bytes)
    const latHex = bodyHex.substring(pos, pos + 8);
    data.latitude = parseInt(latHex, 16) / 1000000;
    data.latitudeHex = latHex;
    data.latitudeDec = parseInt(latHex, 16);
    pos += 8;

    // 4. Longitude (4 bytes)
    const lonHex = bodyHex.substring(pos, pos + 8);
    data.longitude = parseInt(lonHex, 16) / 1000000;
    data.longitudeHex = lonHex;
    data.longitudeDec = parseInt(lonHex, 16);
    pos += 8;

    // 5. Altitude (2 bytes)
    data.altitude = parseInt(bodyHex.substring(pos, pos + 4), 16);
    data.altitudeHex = bodyHex.substring(pos, pos + 4);
    pos += 4;

    // 6. Speed (2 bytes) - in 0.1 km/h units
    const speedRaw = parseInt(bodyHex.substring(pos, pos + 4), 16);
    data.speed = speedRaw / 10;
    data.speedHex = bodyHex.substring(pos, pos + 4);
    data.speedRaw = speedRaw;
    pos += 4;

    // 7. Direction (2 bytes)
    data.direction = parseInt(bodyHex.substring(pos, pos + 4), 16);
    data.directionHex = bodyHex.substring(pos, pos + 4);
    pos += 4;

    // 8. Time (6 bytes BCD)
    const timeHex = bodyHex.substring(pos, pos + 12);
    data.gpsTimeHex = timeHex;
    const bcdTime = parseBCDTimeComponents(timeHex);
    data.gpsTime = bcdTime.gpsTime;
    Object.assign(data, bcdTime);
    pos += 12;

    // Apply hemisphere corrections
    if (data.statusDetails.isSouth) {
      data.latitude *= -1;
    }
    if (data.statusDetails.isWest) {
      data.longitude *= -1;
    }

    // Create summary
    data.locationInfo = {
      coordinates: `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`,
      speed: `${data.speed.toFixed(1)} km/h`,
      direction: `${data.direction}°`,
      altitude: `${data.altitude}m`,
      timestamp: data.gpsTime,
      status: data.statusDetails.located ? "GPS Fixed" : "No GPS Fix",
      accStatus: data.statusDetails.accOn ? "ON" : "OFF",
    };
  } catch (error: any) {
    data.parseError = error.message;
    data.rawBodyHex = bodyHex;
  }

  return data;
}

/**
 * Parse cell tower information from extension data
 */
export function parseCellTowerInfo(ascii: string): any {
  try {
    const nullTerminatorIndex = ascii.indexOf("\x00");
    let cellTowerString = ascii;

    if (nullTerminatorIndex !== -1 && nullTerminatorIndex < ascii.length - 1) {
      const remaining = ascii.substring(nullTerminatorIndex + 1);
      const cellTowerMatch = remaining.match(/(\d{1,3});(\d{1,3});(\d+);(\d+)/);

      if (cellTowerMatch) {
        cellTowerString = remaining;
      }
    }

    const cellTowerMatch = cellTowerString.match(
      /(\d{1,3});(\d{1,3});(\d+);(\d+)/,
    );

    if (cellTowerMatch) {
      const [full, mcc, mnc, lac, cellId] = cellTowerMatch;

      let operator = "Unknown";
      let country = "Unknown";

      // MCC to country mapping (common ones)
      const mccMap: Record<string, string> = {
        "234": "United Kingdom",
        "310": "United States",
        "311": "United States",
        "312": "United States",
        "460": "China",
        "404": "India",
        "405": "India",
      };

      country = mccMap[mcc] || "Unknown";

      if (mcc === "234") {
        // United Kingdom operators
        if (mnc === "15") operator = "Vodafone UK";
        else if (mnc === "20") operator = "Three UK";
        else if (mnc === "10" || mnc === "11") operator = "O2 UK";
        else if (mnc === "30" || mnc === "33") operator = "EE";
      }

      return {
        mcc: mcc,
        mnc: mnc,
        lac: parseInt(lac),
        cellId: parseInt(cellId),
        operator: operator,
        country: country,
        fullInfo: `MCC: ${mcc}, MNC: ${mnc}, LAC: ${lac}, Cell: ${cellId} (${operator})`,
        raw: ascii,
      };
    }

    return {
      raw: ascii,
      error: "No cell tower pattern found",
    };
  } catch (error: any) {
    return {
      raw: ascii,
      error: error.message,
    };
  }
}

/**
 * Get battery status from voltage
 */
export function getBatteryStatus(voltage: number): string {
  if (voltage >= 3.8) return "Full (≥3.8V)";
  if (voltage >= 3.5) return "Good (3.5-3.8V)";
  if (voltage >= 3.3) return "Medium (3.3-3.5V)";
  if (voltage >= 3.1) return "Low (3.1-3.3V)";
  return "Critical (<3.1V)";
}

/**
 * Parse location extensions with proper TLV handling
 */
export function parseLocationExtensions(
  extensionHex: string,
  statusDetails: any = {},
  logger?: any,
): any {
  const data: any = {
    extensions: [],
    extensionDetails: {},
  };

  try {
    let pos = 0;

    while (pos + 4 <= extensionHex.length) {
      // Read tag (1 byte)
      const tagHex = extensionHex.substring(pos, pos + 2);
      const tag = parseInt(tagHex, 16);
      pos += 2;

      // Read length (1 byte)
      const lengthHex = extensionHex.substring(pos, pos + 2);
      const length = parseInt(lengthHex, 16);
      pos += 2;

      // Validate we have enough data
      if (pos + length * 2 > extensionHex.length) {
        if (logger) {
          logger.warn(
            `Extension 0x${tagHex}: insufficient data (need ${length} bytes, have ${(extensionHex.length - pos) / 2})`,
          );
        }
        break;
      }

      // Read value
      const valueHex = extensionHex.substring(pos, pos + length * 2);
      pos += length * 2;

      const extension: any = {
        id: tag,
        idHex: tagHex.toUpperCase(),
        length: length,
        valueHex: valueHex,
      };

      // Parse known extension types
      switch (tag) {
        case 0x01: // Mileage
          extension.name = "Mileage";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: `${(extension.value / 10).toFixed(1)} km`,
            unit: "km",
            raw: extension.value,
          };
          data.mileage = extension.value / 10;
          break;

        case 0x02: // Fuel Level
          extension.name = "Fuel Level";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: `${(extension.value / 10).toFixed(1)} L`,
            unit: "L",
            raw: extension.value,
          };
          data.fuelLevel = extension.value / 10;
          break;

        case 0x03: // Speed (recording instrument)
          extension.name = "Recording Instrument Speed";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: `${(extension.value / 10).toFixed(1)} km/h`,
            unit: "km/h",
            raw: extension.value,
          };
          break;

        case 0x04: // Alarm Event ID
          extension.name = "Alarm Event ID";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: extension.value,
            description: `Event ID: ${extension.value}`,
          };
          break;

        case 0x11: // Overspeed Alarm Additional Info
          extension.name = "Overspeed Alarm Info";
          const locationType = parseInt(valueHex.substring(0, 2), 16);
          const areaId = parseInt(valueHex.substring(2), 16);
          extension.decoded = {
            locationType:
              locationType === 0
                ? "No specific location"
                : "Specific area/route",
            areaId: areaId,
          };
          break;

        case 0x12: // In/Out Area/Route Alarm
          extension.name = "Area/Route Alarm Info";
          const direction = parseInt(valueHex.substring(0, 2), 16);
          const routeId = parseInt(valueHex.substring(2, 10), 16);
          extension.decoded = {
            direction: direction === 1 ? "In" : "Out",
            routeId: routeId,
          };
          break;

        case 0x13: // Route Driving Time
          extension.name = "Route Driving Time";
          extension.value = parseInt(valueHex.substring(8), 16);
          extension.decoded = {
            routeId: parseInt(valueHex.substring(0, 8), 16),
            drivingTime: extension.value,
            drivingTimeFormatted: `${Math.floor(extension.value / 60)}m ${extension.value % 60}s`,
          };
          break;

        case 0x14: // Reserved/Custom Extension
          extension.name = "Custom Extension 0x14";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            raw: valueHex,
            decimal: extension.value,
          };
          break;

        case 0x15: // Satellite Positioning Status
          extension.name = "Satellite Positioning Status";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: extension.value,
            description:
              extension.value === 0 ? "Not positioned" : "Positioned",
          };
          break;

        case 0x16: // Reserved/Custom Extension
          extension.name = "Custom Extension 0x16";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            raw: valueHex,
            decimal: extension.value,
          };
          break;

        case 0x17: // Overspeed Duration
          extension.name = "Overspeed Duration";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            duration: extension.value,
            formatted: `${Math.floor(extension.value / 60)}m ${extension.value % 60}s`,
            unit: "seconds",
          };
          break;

        case 0x18: // Area/Route Alarm Info
          extension.name = "Area/Route Info";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            raw: valueHex,
            value: extension.value,
            description: "Area or route related data",
          };
          break;

        case 0x19: // Retransmission Count
          extension.name = "Retransmission Count";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            count: extension.value,
            description: `Retransmitted ${extension.value} time(s)`,
          };
          break;

        case 0x25: // Extended Vehicle Signal Status
          extension.name = "Vehicle Signal Status";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = parseVehicleSignalStatus(extension.value);
          break;

        case 0x2a: // IO Status
          extension.name = "IO Status";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = parseIOStatus(extension.value);
          break;

        case 0x2b: // Analog Input
          extension.name = "Analog Input";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            voltage: (extension.value / 100).toFixed(2),
            unit: "V",
          };
          break;

        case 0x30: // GSM Signal Strength
          extension.name = "GSM Signal Strength";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            value: extension.value,
            max: 31,
            percentage: Math.round((extension.value / 31) * 100),
            quality: getAccurateSignalQuality(extension.value),
          };
          data.signalStrength = extension.value;
          data.signalQuality = extension.decoded.quality;
          break;

        case 0x31: // GNSS Satellite Count
          extension.name = "GNSS Satellite Count";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            count: extension.value,
            fixQuality: getGPSFixQuality(
              extension.value,
              statusDetails.located || false,
            ),
          };
          data.satelliteCount = extension.value;
          data.fixQuality = extension.decoded.fixQuality;
          break;

        case 0x52: // Custom Extension
          extension.name = "Custom Extension 0x52";
          extension.value = parseInt(valueHex, 16);
          extension.decoded = {
            raw: valueHex,
            decimal: extension.value,
            description: "Device-specific custom data",
          };
          break;

        case 0xeb: // Cell Tower Information + Nested Parameters
          extension.name = "Cell Tower Information";
          extension.value = Buffer.from(valueHex, "hex").toString("ascii");
          const cellInfo = parseCellTowerInfo(extension.value);
          extension.decoded = cellInfo;
          data.cellTowerInfo = cellInfo;

          // Parse nested parameters (battery voltage, etc.)
          const nestedParams = parseNestedParametersInEB(valueHex);
          if (nestedParams.parameters.length > 0) {
            extension.nestedParameters = nestedParams.parameters;
            data.nestedParameters = nestedParams.parameters;

            // Extract battery voltage if present
            const batteryParam = nestedParams.parameters.find(
              (p: any) => p.tag === 0x04 || p.name === "Battery Voltage",
            );
            if (batteryParam && batteryParam.decodedValue !== undefined) {
              data.power = {
                battery: {
                  voltage: batteryParam.decodedValue,
                  voltageFormatted: `${batteryParam.decodedValue.toFixed(2)}V`,
                  status: getBatteryStatus(batteryParam.decodedValue),
                  raw: batteryParam.value,
                },
              };
            }
          }
          break;

        default:
          extension.name = `Unknown Extension 0x${tagHex.toUpperCase()}`;
          extension.value = valueHex;
          extension.decoded = { raw: valueHex };
          break;
      }

      data.extensions.push(extension);
      data.extensionDetails[extension.idHex] = extension;
    }

    if (pos < extensionHex.length) {
      data.unparsedBytes = extensionHex.substring(pos);
      data.unparsedBytesLength = (extensionHex.length - pos) / 2;
    }
  } catch (error: any) {
    data.parseError = error.message;
    data.rawExtensionHex = extensionHex;
  }

  return data;
}

/**
 * Parse vehicle signal status bits
 */
function parseVehicleSignalStatus(value: number): any {
  return {
    lowBeam: !!(value & (1 << 0)),
    highBeam: !!(value & (1 << 1)),
    rightTurnSignal: !!(value & (1 << 2)),
    leftTurnSignal: !!(value & (1 << 3)),
    brake: !!(value & (1 << 4)),
    reverse: !!(value & (1 << 5)),
    fogLight: !!(value & (1 << 6)),
    positionLight: !!(value & (1 << 7)),
    horn: !!(value & (1 << 8)),
    airConditioner: !!(value & (1 << 9)),
    neutral: !!(value & (1 << 10)),
    retarder: !!(value & (1 << 11)),
    abs: !!(value & (1 << 12)),
    heater: !!(value & (1 << 13)),
    clutch: !!(value & (1 << 14)),
  };
}

/**
 * Parse IO status bits
 */
function parseIOStatus(value: number): any {
  return {
    deepSleep: !!(value & (1 << 0)),
    sleep: !!(value & (1 << 1)),
    raw: value,
  };
}

/**
 * Parse nested parameters within 0xEB extension value (like packet-parser.js)
 * Extracts battery voltage and other nested data
 */
export function parseNestedParametersInEB(hexValue: string): any {
  const result: any = {
    parameters: [],
  };

  try {
    const hexString = hexValue.toUpperCase();

    // Look for battery voltage pattern: 00 04 00 2D [value]
    const batteryPattern = "0004002D";
    const batteryIndex = hexString.indexOf(batteryPattern);

    if (batteryIndex !== -1) {
      const valueStart = batteryIndex + 8; // Skip "0004002D"
      if (valueStart + 4 <= hexString.length) {
        const batteryHex = hexString.substring(valueStart, valueStart + 4);
        const batteryValue = parseInt(batteryHex, 16);
        const batteryVoltage = batteryValue / 1000; // Convert to volts

        result.parameters.push({
          tag: 0x04,
          name: "Battery Voltage",
          valueHex: batteryHex,
          value: batteryValue,
          decodedValue: batteryVoltage,
          formatted: `${batteryVoltage.toFixed(2)}V`,
          status: getBatteryStatus(batteryVoltage),
          description: `Battery: ${batteryVoltage.toFixed(2)}V (${getBatteryStatus(batteryVoltage)})`,
        });
      }
    }

    // Look for other nested parameters: 00 [tag] [length] [value]
    let searchPos = 0;
    while (searchPos < hexString.length - 4) {
      if (hexString.substring(searchPos, searchPos + 2) === "00") {
        const nestedTag = parseInt(
          hexString.substring(searchPos + 2, searchPos + 4),
          16,
        );
        const nestedLength = parseInt(
          hexString.substring(searchPos + 4, searchPos + 6),
          16,
        );

        if (
          !isNaN(nestedLength) &&
          nestedLength > 0 &&
          nestedLength < 255 &&
          searchPos + 6 + nestedLength * 2 <= hexString.length
        ) {
          const valueHex = hexString.substring(
            searchPos + 6,
            searchPos + 6 + nestedLength * 2,
          );
          const value = parseInt(valueHex, 16);

          let paramName = "Unknown Parameter";
          let decodedValue: any = value;
          let formatted = valueHex;

          switch (nestedTag) {
            case 0x01:
              paramName = "Custom Parameter 1";
              break;
            case 0x02:
              paramName = "Custom Parameter 2";
              break;
            case 0x03:
              paramName = "Custom Parameter 3";
              break;
            case 0x04:
              if (result.parameters.every((p: any) => p.tag !== 0x04)) {
                paramName = "Battery Voltage";
                decodedValue = value / 1000;
                formatted = `${decodedValue.toFixed(2)}V`;
              }
              break;
            default:
              paramName = `Parameter 0x${nestedTag.toString(16).padStart(2, "0").toUpperCase()}`;
          }

          if (
            nestedTag !== 0x00 &&
            !result.parameters.some((p: any) => p.tag === nestedTag)
          ) {
            result.parameters.push({
              tag: nestedTag,
              name: paramName,
              length: nestedLength,
              valueHex: valueHex,
              value: value,
              decodedValue: decodedValue,
              formatted: formatted,
            });
          }

          searchPos += 6 + nestedLength * 2;
          continue;
        }
      }
      searchPos += 2;
    }
  } catch (error: any) {
    console.error("Error parsing nested parameters:", error.message);
  }

  return result;
}
