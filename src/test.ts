import * as ipc from './index';

const server = new ipc.server('log'),
    client = new ipc.client('log');

server.on('123', (d) => {
    console.log(d);
});

client.send('123', [1, 2, 3])
