import Binance from 'node-binance-api';

export function binanceAPI(BinanceKeys) {
  return new Binance().options({
    APIKEY: BinanceKeys.public,
    APISECRET: BinanceKeys.secret,
    useServerTime: true,
    reconnect: true,
    // verbose: true,
    recvWindow: 10000, // Set a higher recvWindow to increase response timeout
  });
}
