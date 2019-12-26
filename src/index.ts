import * as net from 'net';
import { fast as uuid } from 'fast-unique-id';
import safeStringify from 'fast-safe-stringify';

type requestHandler = (req: string[], res?: response) => void;
type response = (err: any, result?: any) => void;

export class server {
    private eventListeners: {
        [event: string]: requestHandler;
    } = {};

    constructor(id: string) {
        const createServer = () => {
            const ipcServer = net.createServer((socket: net.Socket) => {
                const parse = (data: string) => {
                    const res = data[0] !== '⚐',
                        stringArray = data.slice(res ? 18 : 1).split('⚑');
                    if (!this.eventListeners[stringArray[0]]) return;
                    this.eventListeners[stringArray[0]](stringArray.slice(1), res ? (err: any, result: any) => {
                        if (socket.writable) socket.write(safeStringify({
                            i: data.slice(0, 18),
                            e: err,
                            r: result
                        }) + '⚑');
                    } : undefined);
                }
                let previousData = '';

                socket
                    .on('data', parseChunk)
                    .on('error', (err) => {
                        throw err;
                    }).on('close', () => {
                        socket.removeAllListeners();
                        socket.destroy();
                    }).setEncoding('utf8');

                function parseChunk(data: string) {
                    let lastIndex = -2,
                        indexes = [];

                    while (lastIndex !== -1)
                        lastIndex = data.indexOf('\f', lastIndex !== -2 ? lastIndex + 1 : 0), indexes.push(lastIndex)

                    const separatorsCount = indexes.length - 1;

                    if (separatorsCount) {
                        for (let i = 0, l = separatorsCount; i < l; i++) {
                            let chunk = data.slice(indexes[i - 1] + 1, indexes[i]);
                            if (previousData) chunk = previousData + chunk, previousData = '';
                            parse(chunk);
                        }
                        previousData = data.slice(indexes[separatorsCount - 1] + 1);
                    } else previousData += data;
                }

            }).on('error', err => {
                throw err;
            }).on('close', () => {
                ipcServer.removeAllListeners();
                setTimeout(createServer, 1000);
                throw `ipc server ${id} closed`;
            }).listen('\\\\?\\pipe\\' + id);
        }
        createServer();
    }

    on(event: string, handler: requestHandler) {
        this.eventListeners[event] = handler;
        return this;
    }
}

export class client {
    private ipcClient: net.Socket;
    private resMap: {
        [id: string]: response
    } = {};

    public connected: boolean = false;

    constructor(id: string) {
        const t = Date.now(),
            connect = () => {
                if (this.ipcClient) this.ipcClient.destroy();

                const exec = (json: { i: string, e: any, r: any }) => {
                    this.resMap[json.i](json.e, json.r);
                    delete this.resMap[json.i];
                }
                let previousData = '';

                this.ipcClient = net.createConnection('\\\\?\\pipe\\' + id, () => {
                    this.connected = true;
                }).on('error', (err) => {
                    if (Date.now() - t > 2000) throw err;
                }).on('close', () => {
                    this.connected = false;
                    setTimeout(connect, 1000);
                }).on('data', parseChunk)
                    .setEncoding('utf8');

                function parseChunk(data: string) {
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
                }
            }
        connect();
    }

    send(type: string, req: (string | number)[], res?: response) {
        if (!this.connected) return setTimeout(() => this.send(type, req, res), 1000);
        let id: string;
        if (res) {
            id = uuid();
            this.resMap[id] = res;
        } else id = '⚐';
        let msg = [type, ...req].join('⚑');
        if (msg.indexOf('\f') > -1) msg = msg.replace(/\f/g, '\n');
        this.ipcClient.write(id + msg + '\f');
    }
}