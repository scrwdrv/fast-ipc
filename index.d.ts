declare type requestHandler = (req: (string | number)[], res?: response) => void;
declare type response = (err: any, result?: any) => void;
export declare class server {
    private eventListeners;
    constructor(id: string);
    on(event: string, handler: requestHandler): this;
}
export declare class client {
    private ipcClient;
    private resMap;
    connected: boolean;
    constructor(id: string);
    send(type: string, req: (string | number)[], res?: response): any;
}
export {};
