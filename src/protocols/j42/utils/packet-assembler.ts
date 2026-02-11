/**
 * Packet Assembly Utilities
 * Handles multi-packet assembly and packet validation
 */

interface PacketFragment {
  deviceId: string;
  messageId: string;
  totalPackets: number;
  packetNumber: number;
  data: Buffer;
  timestamp: number;
}

class PacketAssembler {
  private fragments: Map<string, Map<number, PacketFragment>> = new Map();
  private readonly FRAGMENT_TIMEOUT = 30000; // 30 seconds

  /**
   * Add a packet fragment
   * Returns complete packet if all fragments received, null otherwise
   */
  addFragment(fragment: PacketFragment): Buffer | null {
    const key = `${fragment.deviceId}_${fragment.messageId}`;

    if (!this.fragments.has(key)) {
      this.fragments.set(key, new Map());
    }

    const packetMap = this.fragments.get(key)!;
    packetMap.set(fragment.packetNumber, fragment);

    // Check if we have all fragments
    if (packetMap.size === fragment.totalPackets) {
      const completeData = this.assemblePacket(
        packetMap,
        fragment.totalPackets,
      );
      this.fragments.delete(key);
      return completeData;
    }

    // Clean up old fragments
    this.cleanupOldFragments();

    return null;
  }

  /**
   * Assemble complete packet from fragments
   */
  private assemblePacket(
    fragments: Map<number, PacketFragment>,
    totalPackets: number,
  ): Buffer {
    const buffers: Buffer[] = [];

    for (let i = 1; i <= totalPackets; i++) {
      const fragment = fragments.get(i);
      if (!fragment) {
        throw new Error(`Missing packet fragment ${i}/${totalPackets}`);
      }
      buffers.push(fragment.data);
    }

    return Buffer.concat(buffers);
  }

  /**
   * Clean up fragments older than timeout
   */
  private cleanupOldFragments(): void {
    const now = Date.now();

    for (const [key, packetMap] of this.fragments.entries()) {
      for (const [num, fragment] of packetMap.entries()) {
        if (now - fragment.timestamp > this.FRAGMENT_TIMEOUT) {
          packetMap.delete(num);
        }
      }

      if (packetMap.size === 0) {
        this.fragments.delete(key);
      }
    }
  }

  /**
   * Clear all fragments for a device
   */
  clearDevice(deviceId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.fragments.keys()) {
      if (key.startsWith(deviceId + "_")) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.fragments.delete(key));
  }
}

export const packetAssembler = new PacketAssembler();
