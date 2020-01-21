"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const fast_unique_id_1 = require("fast-unique-id");
const fs = require("fs");
class server {
    constructor(id) {
        this.eventListeners = {};
        try {
            fs.unlinkSync('\\\\?\\pipe\\' + id);
        }
        catch (err) { }
        const createServer = () => {
            const ipcServer = net.createServer((socket) => {
                const parse = (data) => {
                    const res = data[0] !== '⚐', stringArray = data.slice(res ? 18 : 1).split('⚑');
                    if (!this.eventListeners[stringArray[0]])
                        return;
                    this.eventListeners[stringArray[0]](stringArray.slice(1), res ? (err, result) => {
                        if (socket.writable)
                            socket.write(JSON.stringify({
                                i: data.slice(0, 18),
                                e: err,
                                r: result
                            }) + '⚑');
                    } : undefined);
                };
                let previousData = '';
                socket
                    .on('data', parseChunk)
                    .on('error', (err) => {
                    throw err;
                }).on('close', () => {
                    socket.removeAllListeners();
                    socket.destroy();
                }).setEncoding('utf8');
                function parseChunk(data) {
                    let lastIndex = -2, indexes = [];
                    while (lastIndex !== -1)
                        lastIndex = data.indexOf('\f', lastIndex !== -2 ? lastIndex + 1 : 0), indexes.push(lastIndex);
                    const separatorsCount = indexes.length - 1;
                    if (separatorsCount) {
                        for (let i = 0, l = separatorsCount; i < l; i++) {
                            let chunk = data.slice(indexes[i - 1] + 1, indexes[i]);
                            if (previousData)
                                chunk = previousData + chunk, previousData = '';
                            parse(chunk);
                        }
                        previousData = data.slice(indexes[separatorsCount - 1] + 1);
                    }
                    else
                        previousData += data;
                }
            }).on('error', err => {
                throw err;
            }).on('close', () => {
                ipcServer.removeAllListeners();
                setTimeout(createServer, 1000);
                throw `ipc server ${id} closed`;
            }).listen('\\\\?\\pipe\\' + id);
        };
        createServer();
    }
    on(event, handler) {
        this.eventListeners[event] = handler;
        return this;
    }
}
exports.server = server;
class client {
    constructor(id) {
        this.resMap = {};
        this.backlogs = [];
        this.connected = false;
        const t = Date.now(), connect = () => {
            if (this.ipcClient)
                this.ipcClient.destroy();
            const exec = (json) => {
                this.resMap[json.i](json.e, json.r);
                delete this.resMap[json.i];
            };
            let previousData = '';
            this.ipcClient = net.createConnection('\\\\?\\pipe\\' + id, () => {
                this.connected = true;
                const l = this.backlogs.length;
                if (l)
                    for (let i = l; i--;)
                        this.send(...this.backlogs.pop());
            }).on('error', (err) => {
                if (Date.now() - t > 2000)
                    throw err;
            }).on('close', () => {
                this.connected = false;
                connect();
            }).on('data', parseChunk)
                .setEncoding('utf8');
            function parseChunk(data) {
                let lastIndex = -2, indexes = [];
                while (lastIndex !== -1)
                    lastIndex = data.indexOf('⚑', lastIndex !== -2 ? lastIndex + 1 : 0), indexes.push(lastIndex);
                const separatorsCount = indexes.length - 1;
                if (separatorsCount) {
                    for (let i = 0, l = separatorsCount; i < l; i++) {
                        let chunk = data.slice(indexes[i - 1] + 1, indexes[i]);
                        if (previousData)
                            chunk = previousData + chunk, previousData = '';
                        exec(JSON.parse(chunk));
                    }
                    previousData = data.slice(indexes[separatorsCount - 1] + 1);
                }
                else
                    previousData += data;
            }
        };
        connect();
    }
    send(type, req, res) {
        if (!this.connected)
            return this.backlogs.push([type, req, res]);
        let id;
        if (res) {
            id = fast_unique_id_1.fast();
            this.resMap[id] = res;
        }
        else
            id = '⚐';
        let msg = [type, ...req].join('⚑');
        if (msg.indexOf('\f') > -1)
            msg = msg.replace(/\f/g, '\n');
        this.ipcClient.write(id + msg + '\f');
    }
}
exports.client = client;
