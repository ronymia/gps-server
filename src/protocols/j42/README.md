# J42 Protocol

This directory contains the J42 protocol implementation copied from the j42-server project.

## Files Overview

### Core Files

1. **server.js** - Main server implementation
   - Handles TCP/UDP connections
   - Processes incoming GPS data
   - Manages device connections
   - Implements JT808 protocol support

2. **packet-parser.js** - Packet parsing logic
   - Parses J42 protocol packets
   - Handles JT808 protocol packets
   - Extracts GPS location data
   - Parses alarm flags and status flags
   - Handles battery voltage and signal strength

3. **jt808-ack.js** - JT808 Protocol Handler
   - BCD encoding/decoding
   - Frame escaping/unescaping
   - Checksum validation
   - Response generation (0x8001 ACK, 0x8100 login response)
   - Command builders

4. **api-controller.js** - API Controller
   - REST API endpoints
   - Packet data retrieval
   - Parsing and decoding API
   - Device statistics
   - Command sending functionality

5. **port.js** - Port configuration
   - Centralized port management
   - Environment-based configuration

## Protocol Support

The J42 protocol implementation supports:

- **JT808 Protocol**: Chinese GPS tracking protocol (primary)
- **J42 SMS Commands**: Legacy text-based commands
- **Position Reporting**: GPS location, speed, direction
- **Alarm Handling**: Various alarm types
- **Device Authentication**: Terminal registration and authentication

## Integration Notes

These files were copied from the j42-server standalone project. They will need to be:

- Converted from CommonJS to TypeScript/ES modules
- Integrated with the NestJS gateway service architecture
- Adapted to use the gateway service's connection management
- Modified to use the fleet management database models

## TODO

- [ ] Convert to TypeScript
- [ ] Integrate with NestJS dependency injection
- [ ] Add proper error handling
- [ ] Connect to database for persistent storage
- [ ] Implement WebSocket for real-time updates
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Document API endpoints
- [ ] Add configuration management

## Original Server

Port Configuration (from original j42-server):

- GPS Server Port: 2017 (TCP/UDP)
- API Server Port: 2020 (HTTP)

## Dependencies

The original implementation uses:

- `dgram` - UDP server
- `net` - TCP server
- `moment` - Date/time handling
- `http` - HTTP API server
- `fs` - File system operations
