/**
 * Checksum calculation utilities for JT/T 808 protocol
 */

/**
 * Calculate XOR checksum for packet data
 * @param buffer - Buffer to calculate checksum for
 * @returns XOR checksum byte
 */
export function calculateChecksum(buffer: Buffer): number {
  let x = 0;
  for (const b of buffer) {
    x ^= b;
  }
  return x & 0xff;
}

/**
 * Verify checksum of a packet
 * @param buffer - Complete buffer including checksum byte
 * @param receivedChecksum - The checksum value to verify against
 * @returns true if checksum is valid
 */
export function verifyChecksum(
  buffer: Buffer,
  receivedChecksum: number,
): boolean {
  const calculated = calculateChecksum(buffer);
  return calculated === receivedChecksum;
}
