import { fast as uuid } from 'fast-unique-id';
import * as fs from 'fs';
import * as net from 'net';

type RequestHandler = (data: any) => any | Promise<any>;
type PromiseHandler = { resolve: (res: any) => void, reject: (err: any) => void };

export interface serverConfig {
    onError?: (err: unknown) => void;
    onClose?: () => void;
}

export interface clientConfig {
    onError?: (err: unknown) => void;
    timeout?: number;
}

export class server {
    #eventListeners: { [event: string]: RequestHandler; } = {};
    #config?: serverConfig;

    constructor(serverName: string, config?: serverConfig) {
        this.#config = config;
        try { fs.unlinkSync('\\\\?\\pipe\\' + serverName) } catch (err) { }
        this.#createServer(serverName);
    }

    #createServer(serverName: string) {
        const ipcServer = net.createServer((socket: net.Socket) => {
            const parse = async (data: string) => {
                const stringArray = data.slice(18).split('⚑');

                const handler = this.#eventListeners[stringArray[0]];
                if (!handler)
                    return;

                let socketData: any;
                try {
                    const body = JSON.parse(stringArray.slice(1)[0]);
                    const response = await handler(body);
                    socketData = { i: data.slice(0, 18), e: null, r: response };
                } catch (err) {
                    socketData = { i: data.slice(0, 18), e: err, r: null };
                } finally {
                    if (socket.writable)
                        socket.write(JSON.stringify(socketData) + '⚑');
                }
            }

            let previousData = '';
            const parseChunk = (data: string) => {
                let lastIndex = -2,
                    indexes = [];

                while (lastIndex !== -1)
                    lastIndex = data.indexOf('\f', lastIndex !== -2 ? lastIndex + 1 : 0), indexes.push(lastIndex)

                const separatorsCount = indexes.length - 1;

                if (separatorsCount) {
                    for (let i = 0, l = separatorsCount; i < l; i++) {
                        let chunk = data.slice(indexes[i - 1] + 1, indexes[i]);

                        if (previousData)
                            chunk = previousData + chunk, previousData = '';

                        parse(chunk);
                    }
                    previousData = data.slice(indexes[separatorsCount - 1] + 1);
                } else {
                    previousData += data;
                }
            }

            socket
                .on('data', parseChunk)
                .on('error', (err) => {
                    if (this.#config?.onError)
                        return this.#config.onError(err);

                    throw err;
                })
                .on('close', () => {
                    socket.removeAllListeners();
                    socket.destroy();
                })
                .setEncoding('utf8');

        })
            .on('error', err => {
                if (this.#config?.onError)
                    return this.#config.onError(err);

                throw err;
            })
            .on('close', () => {
                ipcServer.removeAllListeners();
                setTimeout(() => this.#createServer(serverName), 1000);
                const err = `ipc server ${serverName} closed`;

                if (this.#config?.onClose)
                    return this.#config.onClose();

                if (this.#config?.onError)
                    return this.#config.onError(err);

                throw err;
            })
            .listen('\\\\?\\pipe\\' + serverName);

        process.on("exit", () => {
            try { fs.unlinkSync('\\\\?\\pipe\\' + serverName) } catch (err) { }
        });
    }

    on(event: string, handler: RequestHandler) {
        this.#eventListeners[event] = handler;
        return this;
    }
}

export class client {
    #ipcClient?: net.Socket;
    #resMap: { [id: string]: PromiseHandler } = {};
    #backlogs: [string, any, PromiseHandler][] = [];
    #config?: clientConfig;
    #connected: boolean = false;
    #now = Date.now();

    constructor(serverName: string, config?: clientConfig) {
        this.#config = config;
        this.#connect(serverName);
    }

    #connect(serverName: string) {
        if (this.#ipcClient)
            this.#ipcClient.destroy();

        const exec = (json: { i: string, e: any, r: any }) => {
            const callback = this.#resMap[json.i];

            if (json.e)
                callback.reject(json.e);
            else
                callback.resolve(json.r);

            delete this.#resMap[json.i];
        }

        let previousData = '';
        const parseChunk = (data: string) => {
            let lastIndex = -2,
                indexes = [];

            while (lastIndex !== -1)
                lastIndex = data.indexOf('⚑', lastIndex !== -2 ? lastIndex + 1 : 0), indexes.push(lastIndex)

            const separatorsCount = indexes.length - 1;

            if (separatorsCount) {
                for (let i = 0, l = separatorsCount; i < l; i++) {
                    let chunk = data.slice(indexes[i - 1] + 1, indexes[i]);
                    if (previousData) chunk = previousData + chunk, previousData = '';
                    exec(JSON.parse(chunk));
                }
                previousData = data.slice(indexes[separatorsCount - 1] + 1);
            } else previousData += data;
        };

        this.#ipcClient = net.createConnection('\\\\?\\pipe\\' + serverName, () => {
            this.#connected = true;
            if (this.#backlogs.length > 0) {
                for (let i = this.#backlogs.length; i--;) {
                    const pop = this.#backlogs.pop();
                    if (pop)
                        this.#doSend(...pop);
                }
            }
        })
            .on('error', (err) => {
                if (Date.now() - this.#now <= (this.#config?.timeout ?? 2000))
                    return;

                if (this.#config?.onError)
                    return this.#config.onError(err);

                throw err;
            })
            .on('close', () => {
                this.#connected = false;
                this.#connect(serverName);
            })
            .on('data', parseChunk)
            .setEncoding('utf8');
    }

    send<T>(type: string, data: any): Promise<T> {
        const promise = new Promise<T>((resolve, reject) => {
            if (!this.#connected)
                return this.#backlogs.push([type, data, { resolve, reject }]);

            this.#doSend(type, data, { resolve, reject });
        });

        return promise;
    }

    #doSend(type: string, req: any, promise: PromiseHandler) {
        const id: string = uuid();
        this.#resMap[id] = promise;
        const data = JSON.stringify(req);
        let msg = [type, data].join('⚑');
        if (msg.indexOf('\f') > -1)
            msg = msg.replace(/\f/g, '\n');

        this.#ipcClient?.write(`${id}${msg}\f`);
    }

    public get connected() {
        return this.#connected;
    }

}