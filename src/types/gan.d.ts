declare module 'gan-web-bluetooth' {
  export function connectGanCube(): Promise<{
    deviceName?: string;
    events$: { subscribe(cb: (ev: { type: string; move?: string }) => void): { unsubscribe(): void } };
    sendCubeCommand(cmd: { type: string }): Promise<void>;
    disconnect(): void;
  }>;
}
