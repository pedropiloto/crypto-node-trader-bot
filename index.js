const CoinbasePro = require('coinbase-pro');
const { RSI } = require('technicalindicators');
require('dotenv').config();
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const axios = require('axios');
const logzio = require('logzio-nodejs').createLogger({
  token: 'YOmGzYNdkNqanYXACMWWwjPeZoKIZfOv',
  protocol: 'https',
  host: 'listener.logz.io',
  port: '8071',
  type: 'nodejs',
});

const key = `${process.env.API_KEY}`;
const secret = `${process.env.API_SECRET}`;
const passphrase = `${process.env.API_PASSPHRASE}`;
const ordersServiceUrl = `${process.env.ORDERS_SERVICE_URL}`;
const baseCurrencyName = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrencyName = `${process.env.QUOTE_CURRENCY_NAME}`;
const appName = `${process.env.APP_NAME}`;

// const websocketURI = "wss://ws-feed.pro.coinbase.com";
// const websocketURI = "wss://ws-feed-public.sandbox.pro.coinbase.com";
const websocketURI = `${process.env.WEB_SOCKET_URI}`;

const productInfo = {
  baseCurrency: baseCurrencyName,
  quoteCurrency: quoteCurrencyName,
  productPair: `${baseCurrencyName}-${quoteCurrencyName}`,
  productPairFriendlyName: baseCurrencyName + quoteCurrencyName,
};

function analyseRSI(value) {
  if (value <= 30) {
    logger.debug('less or equal to 30, requesting order to buy ');
    logzio.log({ message: 'less or equal to 30, requesting order to buy', app_name: appName });
    axios.post(ordersServiceUrl,
      {
        metric: 'RSI',
        symbol: productInfo.productPairFriendlyName,
        action: 'BUY',
        platform: 'websocket-bot',
        metric_value: value,
      })
      .then((response) => {
        logger.debug(`sucessfully requested a buy order:${JSON.stringify(response.data.success)}`);
        logzio.log({ message: 'sucessfully requested a buy order', status: response.data.success, app_name: appName });
      })
      .catch((error) => {
        logger.debug(`error requesting a buy order:${error}`);
        logzio.log({ message: 'error requesting buy order', error, app_name: appName });
      });
  } else if (value >= 70) {
    logger.debug('higher or equal to 70, requesting order to sell ');
    axios.post(ordersServiceUrl,
      {
        metric: 'RSI',
        symbol: productInfo.productPairFriendlyName,
        action: 'SELL',
        platform: 'websocket-bot',
        metric_value: value,
      })
      .then((response) => {
        logger.debug(`sucessfully requested a sell order:${JSON.stringify(response.data.success)}`);
        logzio.log({ message: 'sucessfully requested a sell order', status: response.data.success, app_name: appName });
      })
      .catch((error) => {
        logger.debug(`error requesting a sell order: ${error}`);
        logzio.log({ message: 'error requesting sell order', error, app_name: appName });
      });
  }
}

/**
 * Creates the websocket object and turns it on to update the currentPrice
 *
 * @param {string} productPair
 */
function listenForPriceUpdates(productPair) {
  const priceArray = [];
  if (productPair == null) {
    throw new Error('Error in listenForPriceUpdates method. ProductPair is null!');
  }

  const websocket = new CoinbasePro.WebsocketClient(
    [productPair],
    websocketURI,
    {
      key,
      secret,
      passphrase,
    },
    { channels: ['ticker'] },
  );

  // turn on the websocket for errors
  websocket.on('error', (err) => {
    const message = 'Error occured in the websocket.';
    const errorMsg = new Error(err);
    logger.error({ message, errorMsg, err });
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for closes to restart it
  websocket.on('close', () => {
    logger.debug('WebSocket closed, restarting...');
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for messages
  websocket.on('message', (data) => {
    if (data.type === 'ticker') {
      const currentPrice = parseFloat(data.price);
      logger.debug(`Ticker price: ${currentPrice}`);
      logzio.log({ message: 'Ticker price', current_price: currentPrice, app_name: appName });
      priceArray.push(Number(currentPrice));
      if (priceArray.length >= 600) {
        logger.debug(`array filled length:${priceArray.length}`);
        logzio.log({ message: 'Princings array', length: priceArray.length });
        const rsi = RSI.calculate({
          values: priceArray,
          period: 14,
        });
        logger.debug(`rsi value:${rsi[rsi.length - 1]}`);
        logzio.log({ message: 'RSI calculated', rsi_value: rsi[rsi.length - 1], app_name: appName });
        analyseRSI(rsi[rsi.length - 1]);
      }
      if (priceArray.length >= 8640) {
        priceArray.shift();
      }
    }
  });
}

try {
  logger.debug('starting');
  logzio.log({ message: 'starting', app_name: appName });

  // activate websocket for price data:
  listenForPriceUpdates(productInfo.productPair);
} catch (error) {
  const message = 'Error occured in bot, shutting down. Check the logs for more information.';
  const errorMsg = new Error(error);
  logzio.log({ message: 'Something went wrong and service needs to be restarted', error, app_name: appName });
  logzio.sendAndClose();
  logger.error({ message, errorMsg, error });
  process.exit(1);
}
