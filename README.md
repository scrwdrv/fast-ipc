# @lzptec/fast-ipc
Fast & simple IPC (Inter-Process Communication) server/client build on native net module

## Installation

npm
```sh
npm i @lzptec/fast-ipc
```

pnpm
```sh
pnpm i @lzptec/fast-ipc
```

## Usage

### Server
```js
import { server } from '@lzptec/fast-ipc';

const ipcServer =
    new server('example')
        .on('msg', (data) => {
            console.log(data);
            // [1, 2, 3, 4, 5]
        })
        .on('ping', () => {
            return 'pong!';
        })
        .on('event', (data) => {
            return {
                data: data,
                timestamp: Date.now()
            };
        });

```

### Client
```js
import { client } from '@lzptec/fast-ipc';

const ipcClinet = new client('example');

ipcClinet.send('msg', [1, 2, 3, 4, 5]);

const msg = await ipcClinet.send('ping', null);
console.log(msg); 
// pong!

const event = await ipcClinet.send('event', [1, 2, 3, 'testing']);

console.log(event);
// { data: [ '1', '2', '3', 'testing' ], timestamp: 1577025604487 }
```

## Original
The original project([fast-ipc](https://github.com/scrwdrv/fast-ipc)) hasn't been updated in the last 2 years, so I created this fork and updated the library 
