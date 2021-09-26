import test from 'ava';
import * as ipc from '../dist/index.js';

const server = new ipc.server('log'),
    client = new ipc.client('log');

test('data', async t => {
    server.on('123', (d) => {
        t.deepEqual(d, { data: 'test' });
        return 123;
    });

    await client.send('123', { data: 'test' })
        .then(response => {
            t.deepEqual(response, 123);
            t.pass();
        })
        .catch(error => {
            t.fail("Expected a response, got an error instead: " + error);
        });
});

test('error', async t => {
    server.on('testError', (d) => {
        t.deepEqual(d, { data: 'test' });
        throw `Error`;
    });

    await client.send('testError', { data: 'test' })
        .then(response => {
            t.fail("Expected an error, got a response instead: " + response);
        })
        .catch(error => {
            t.is(error, `Error`);
            t.pass();
        });
});