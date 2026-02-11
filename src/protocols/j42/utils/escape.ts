/**
 * Frame escaping and unescaping utilities for JT/T 808 protocol
 * Handles 0x7E and 0x7D escape sequences
 */

/**
 * Escape special bytes in frame data
 * 0x7E -> 0x7D 0x02
 * 0x7D -> 0x7D 0x01
 */
export function escape(buffer: Buffer): Buffer {
  const out: number[] = [];
  for (const b of buffer) {
    if (b === 0x7e) {
      out.push(0x7d, 0x02);
    } else if (b === 0x7d) {
      out.push(0x7d, 0x01);
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

/**
 * Unescape frame data
 * 0x7D 0x02 -> 0x7E
 * 0x7D 0x01 -> 0x7D
 *
 * CRITICAL: This must be called BEFORE parsing the packet body
 */
export function unescape(escapedBuffer: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < escapedBuffer.length; i++) {
    const b = escapedBuffer[i];
    if (b === 0x7d && i + 1 < escapedBuffer.length) {
      const n = escapedBuffer[i + 1];
      if (n === 0x01) {
        out.push(0x7d);
        i++; // Skip next byte
        continue;
      }
      if (n === 0x02) {
        out.push(0x7e);
        i++; // Skip next byte
        continue;
      }
      // If 0x7D is not followed by 0x01 or 0x02, it's an error
      // but we'll treat it as a regular byte
      out.push(b);
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

/**
 * Check if buffer contains escape sequences
 */
export function hasEscapeSequences(buffer: Buffer): boolean {
  for (let i = 0; i < buffer.length - 1; i++) {
    if (
      buffer[i] === 0x7d &&
      (buffer[i + 1] === 0x01 || buffer[i + 1] === 0x02)
    ) {
      return true;
    }
  }
  return false;
}
