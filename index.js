const CoinbasePro = require('coinbase-pro');
const { RSI, BollingerBands } = require('technicalindicators');
require('dotenv').config();
const pino = require('pino');
const newrelic = require('newrelic');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const axios = require('axios');
const logzio = require('logzio-nodejs').createLogger({
  token: `${process.env.LOGZIO_TOKEN}`,
  protocol: 'https',
  host: 'listener.logz.io',
  port: '8071',
  type: 'nodejs',
});

const { memoryMetric, cpuUsageMetric } = require('./metric');

const key = `${process.env.API_KEY}`;
const secret = `${process.env.API_SECRET}`;
const passphrase = `${process.env.API_PASSPHRASE}`;
const ordersServiceUrl = `${process.env.ORDERS_SERVICE_URL}`;
const baseCurrencyName = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrencyName = `${process.env.QUOTE_CURRENCY_NAME}`;
const appName = `${process.env.APP_NAME}`;

const OPERATIONAL_LOG_TYPE = 'OPERATIONAL_LOG_TYPE';
const BUSINESS_LOG_TYPE = 'BUSINESS_LOG_TYPE';

// const websocketURI = "wss://ws-feed.pro.coinbase.com";
// const websocketURI = "wss://ws-feed-public.sandbox.pro.coinbase.com";
const websocketURI = `${process.env.WEB_SOCKET_URI}`;

const productInfo = {
  baseCurrency: baseCurrencyName,
  quoteCurrency: quoteCurrencyName,
  productPair: `${baseCurrencyName}-${quoteCurrencyName}`,
  productPairFriendlyName: baseCurrencyName + quoteCurrencyName,
};

function log(params) {
  if (params.type === BUSINESS_LOG_TYPE) {
    logger.debug(JSON.stringify(params));
  } else {
    logger.info(JSON.stringify(params));
  }
  if (process.env.NODE_ENV === 'production') {
    logzio.log(params);
    if (params.transactional_event) {
      if (params.type === BUSINESS_LOG_TYPE) {
        newrelic.recordCustomEvent('BusinessEvent', params);
      }
      if (params.type === OPERATIONAL_LOG_TYPE) {
        newrelic.recordCustomEvent('OperationalEvent', params);
      }
    }
  }
}

function analyseRSI(value, currentPrice) {
  if (value <= 30) {
    axios.post(ordersServiceUrl,
      {
        metric: 'RSI',
        symbol: productInfo.productPairFriendlyName,
        action: 'BUY',
        platform: 'websocket-bot',
        metric_value: value,
      })
      .then((response) => {
        log({
          message: 'sucessfully requested a buy order', status: response.data.success, action: 'BUY', metric: 'RSI', value, current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
        });
      })
      .catch((error) => {
        log({
          message: 'error requesting buy order', error, action: 'BUY', metric: 'RSI', value, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
        });
      });
  } else if (value >= 66) {
    axios.post(ordersServiceUrl,
      {
        metric: 'RSI',
        symbol: productInfo.productPairFriendlyName,
        action: 'SELL',
        platform: 'websocket-bot',
        metric_value: value,
      })
      .then((response) => {
        log({
          message: 'sucessfully requested a sell order', status: response.data.success, action: 'SELL', metric: 'RSI', value, current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
        });
      })
      .catch((error) => {
        log({
          message: 'error requesting sell order', error, action: 'SELL', metric: 'RSI', value, current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
        });
      });
  }
}

function analyseUpperBB(value, currentPrice) {
  if (currentPrice > value) {
    axios.post(ordersServiceUrl,
      {
        metric: 'BB',
        symbol: productInfo.productPairFriendlyName,
        action: 'BUY',
        platform: 'websocket-bot',
        metric_value: value,
      })
      .then((response) => {
        log({
          message: 'sucessfully requested a buy order', status: response.data.success, action: 'BUY', metric: 'BB', value, current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE,
        });
      })
      .catch((error) => {
        log({
          message: 'error requesting buy order', error, action: 'BUY', metric: 'BB', value, app_name: appName, type: BUSINESS_LOG_TYPE,
        });
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
    log({ message, error: errorMsg, type: OPERATIONAL_LOG_TYPE });
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for closes to restart it
  websocket.on('close', () => {
    log({ message: 'WebSocket closed, restarting...', type: OPERATIONAL_LOG_TYPE });
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for messages
  websocket.on('message', (data) => {
    if (data.type === 'ticker') {
      const currentPrice = parseFloat(data.price);
      log({
        message: 'Ticker price', current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE,
      });
      priceArray.push(Number(currentPrice));
      log({
        message: 'Pricings array', length: priceArray.length, app_name: appName, type: BUSINESS_LOG_TYPE,
      });
      if (priceArray.length >= 600) {
        const rsi = RSI.calculate({
          values: priceArray,
          period: 14,
        });
        log({
          message: 'RSI calculated', rsi_value: rsi[rsi.length - 1], app_name: appName, type: BUSINESS_LOG_TYPE,
        });
        const bb = BollingerBands.calculate({
          period: 14,
          values: priceArray,
          stdDev: 2,
        });
        analyseRSI(rsi[rsi.length - 1], currentPrice);
        if (bb[bb.length - 1]) {
          analyseUpperBB(bb[bb.length - 1].upper, currentPrice);
        }
        log({
          message: 'BB calculated', bb_value: bb[bb.length - 1], app_name: appName, type: BUSINESS_LOG_TYPE,
        });
      }
      if (priceArray.length >= 8640) {
        priceArray.shift();
      }
    }
  });
}

try {
  log({ message: 'starting', app_name: appName, type: OPERATIONAL_LOG_TYPE });
  // activate websocket for price data:
  listenForPriceUpdates(productInfo.productPair);
  if (process.env.NODE_ENV === 'production') {
    memoryMetric();
    cpuUsageMetric();
  }
} catch (error) {
  const message = 'Error occured in bot, shutting down. Check the logs for more information.';
  const errorMsg = new Error(error);
  log({
    message, error: errorMsg, app_name: appName, type: OPERATIONAL_LOG_TYPE,
  });
  logzio.sendAndClose();
  process.exit(1);
}
