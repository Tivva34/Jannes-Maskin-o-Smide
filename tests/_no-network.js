// Nätverksskydd: alla tester importerar denna fil. Varje försök till nätverksanrop kastar.
import net from 'node:net';
import tls from 'node:tls';

export const networkAttempts = [];

globalThis.fetch = () => {
  networkAttempts.push('fetch');
  throw new Error('NÄTVERKSANROP BLOCKERAT i test (fetch)');
};
net.Socket.prototype.connect = function () {
  networkAttempts.push('net.connect');
  throw new Error('NÄTVERKSANROP BLOCKERAT i test (net)');
};
tls.connect = () => {
  networkAttempts.push('tls.connect');
  throw new Error('NÄTVERKSANROP BLOCKERAT i test (tls)');
};
