declare module 'asterisk-ami-client' {
  interface AmiClientOptions {
    reconnect?: boolean;
    keepAlive?: boolean;
    emitEventsByType?: boolean;
    emitResponsesById?: boolean;
    maxRetries?: number;
    retryTimeout?: number;
    keepAliveTimeout?: number;
  }

  class AmiClient {
    constructor(options?: AmiClientOptions);
    
    connect(host: string, port: number, username: string, password: string): Promise<unknown>;
    disconnect(): void;
    action(action: Record<string, any>): Promise<any>;
    stop(): void;
    
    on(event: string, handler: (data: any) => void): void;
    removeListener(event: string, handler: (data: any) => void): void;
    once(event: string, handler: (data: any) => void): void;
  }

  export default AmiClient;
}