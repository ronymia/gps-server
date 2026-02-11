/**
 * BCD (Binary Coded Decimal) encoding and decoding utilities
 * Used for terminal ID encoding in JT/T 808 protocol
 */

/**
 * Convert numeric string to BCD buffer (6 bytes for terminal ID typical)
 * Pads with leading zero if odd length.
 * Example: "14093471481" -> Buffer<0x01,0x40,0x93,0x47,0x14,0x81>
 */
export function stringToBCD(
  str: string | number,
  targetLength?: number,
): Buffer {
  // Remove non-digits
  let s = String(str).replace(/\D/g, "");

  // Pad to even length
  if (s.length % 2 !== 0) {
    s = "0" + s;
  }

  // Pad to target length if specified
  if (targetLength) {
    const requiredDigits = targetLength * 2;
    if (s.length < requiredDigits) {
      s = s.padStart(requiredDigits, "0");
    } else if (s.length > requiredDigits) {
      s = s.substring(s.length - requiredDigits); // Keep last N digits
    }
  }

  const out = Buffer.alloc(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    const hi = parseInt(s[i], 10);
    const lo = parseInt(s[i + 1], 10);

    // Validate BCD digits (0-9 only)
    if (hi > 9 || lo > 9) {
      throw new Error(`Invalid BCD digit in input: ${s[i]}${s[i + 1]}`);
    }

    out[i / 2] = (hi << 4) | lo;
  }
  return out;
}

/**
 * Convert BCD buffer to numeric string with validation
 * Example: Buffer<0x01,0x40,0x93,0x47,0x14,0x81> -> "014093471481"
 */
export function bcdToString(
  buffer: Buffer,
  trimLeadingZeros: boolean = false,
): string {
  let s = "";
  for (const b of buffer) {
    const hi = (b >> 4) & 0x0f;
    const lo = b & 0x0f;

    // Validate BCD nibbles (should be 0-9)
    if (hi > 9 || lo > 9) {
      throw new Error(
        `Invalid BCD byte: 0x${b.toString(16).padStart(2, "0")} (nibbles: ${hi}, ${lo})`,
      );
    }

    s += String(hi) + String(lo);
  }

  return trimLeadingZeros ? s.replace(/^0+/, "") || "0" : s;
}

/**
 * Validate if buffer contains valid BCD data
 */
export function isValidBCD(buffer: Buffer): boolean {
  try {
    for (const b of buffer) {
      const hi = (b >> 4) & 0x0f;
      const lo = b & 0x0f;
      if (hi > 9 || lo > 9) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
