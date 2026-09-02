// Global Socket.IO manager to avoid circular dependencies
let ioInstance = null;

class SocketManager {
  static setIO(io) {
    ioInstance = io;
    console.log('Socket.IO instance set successfully');
  }

  static getIO() {
    return ioInstance;
  }

  static emit(event, data) {
    if (ioInstance) {
      ioInstance.emit(event, data);
      console.log(`Socket event emitted: ${event}`, data);
    } else {
      console.warn('Socket.IO not initialized, cannot emit event:', event);
    }
  }

  static emitToRoom(room, event, data) {
    if (ioInstance) {
      ioInstance.to(room).emit(event, data);
      console.log(`Socket event emitted to room ${room}: ${event}`, data);
    } else {
      console.warn('Socket.IO not initialized, cannot emit to room:', room);
    }
  }
}

module.exports = SocketManager;
