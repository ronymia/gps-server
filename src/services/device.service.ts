/**
 * Device Connection Service
 * Manages active device connections
 */

export class DeviceService {
  private connections = new Map<string, any>();

  /**
   * Register a device connection
   */
  register(deviceId: string, connectionInfo: any): void {
    this.connections.set(deviceId, {
      ...connectionInfo,
      connectedAt: connectionInfo.connectedAt || new Date(),
      lastSeen: new Date(),
    });
  }

  /**
   * Update device status
   */
  updateStatus(deviceId: string, status: string): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.status = status;
    }
  }

  /**
   * Update last seen timestamp
   */
  updateLastSeen(deviceId: string): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.lastSeen = new Date();
    }
  }

  /**
   * Remove a device connection
   */
  remove(deviceId: string): void {
    this.connections.delete(deviceId);
  }

  /**
   * Remove connection by socket
   */
  removeBySocket(socket: any): string | null {
    for (const [deviceId, conn] of this.connections.entries()) {
      if (conn.socket === socket) {
        this.connections.delete(deviceId);
        return deviceId;
      }
    }
    return null;
  }

  /**
   * Get connection info for a device
   */
  get(deviceId: string): any | null {
    return this.connections.get(deviceId) || null;
  }

  /**
   * Get all active connections
   */
  getAll(): Array<{ deviceId: string; connection: any }> {
    return Array.from(this.connections.entries()).map(
      ([deviceId, connection]) => ({
        deviceId,
        connection,
      }),
    );
  }

  /**
   * Get connection count
   */
  count(): number {
    return this.connections.size;
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId: string): boolean {
    return this.connections.has(deviceId);
  }

  /**
   * Get devices by protocol
   */
  getByProtocol(
    protocol: string,
  ): Array<{ deviceId: string; connection: any }> {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.protocol === protocol)
      .map(([deviceId, connection]) => ({ deviceId, connection }));
  }
}
