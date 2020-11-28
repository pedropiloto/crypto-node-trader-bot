const CoinbasePro = require('coinbase-pro');
const Bugsnag = require('@bugsnag/js');
const util = require('util');
require('dotenv').config();

const Product = require('../models/product');
const mongoose = require('../config/database');
const { log, sendAndCloseLogzio } = require('../utils/logger');
const {
  OPERATIONAL_LOG_TYPE: OPERATIONAL, ERROR_SEVERITY: ERROR,
} = require('../utils/constants');
const { memoryMetric, cpuUsageMetric } = require('../metric');
const WebSocketMessageInteractor = require('../interactors/websocket-message-interactor');

const key = `${process.env.API_KEY}`;
const secret = `${process.env.API_SECRET}`;
const passphrase = `${process.env.API_PASSPHRASE}`;
const baseCurrency = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrency = `${process.env.QUOTE_CURRENCY_NAME}`;
const websocketURI = process.env.USE_SANDBOX === 'false'
  ? 'wss://ws-feed.pro.coinbase.com'
  : 'wss://ws-feed-public.sandbox.pro.coinbase.com';

const webSocketClose = (callback, productPair) => () => {
  log({
    message: 'WebSocket closed, restarting...', type: OPERATIONAL, transactional: true, severity: ERROR,
  });
  callback(productPair);
};

const webSocketError = (error) => {
  const message = 'Error occured in the websocket.';
  log({
    message,
    error,
    type: OPERATIONAL,
    transactional: true,
    severity: ERROR,
  });
  Bugsnag.notify(util.inspect(error));
  process.exit(1);
};

const DBErrorHandler = () => {
  log({
    message: 'MongoDB connection error',
    type: OPERATIONAL,
    transactional: true,
    severity: ERROR,
  });
  Bugsnag.notify(util.inspect(new Error('MongoDB connection error')));
};

/**
 * Creates the websocket object and turns it on to update the currentPrice
 *
 * @param {string} productPair
 */
function listenForPriceUpdates(productPair) {
  if (productPair == null) {
    const error = new Error('Error in listenForPriceUpdates method. ProductPair is null!');
    Bugsnag.notify(util.inspect(error));
    throw error;
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
  websocket.on('error', webSocketError);

  // Turn on the websocket for closes to restart it
  websocket.on('close', webSocketClose(listenForPriceUpdates, productPair));

  // Turn on the websocket for messages
  websocket.on('message', WebSocketMessageInteractor);
}

try {
  const productInfo = new Product(
    baseCurrency, quoteCurrency,
  );

  log({ message: 'starting', type: OPERATIONAL, transactional: true });

  // activate websocket for price data:
  listenForPriceUpdates(productInfo.productPair);
  if (process.env.NODE_ENV === 'production' && process.env.BUSGNAG_API_KEY) {
    memoryMetric();
    cpuUsageMetric();
    Bugsnag.start({ apiKey: `${process.env.BUSGNAG_API_KEY}` });
  }

  mongoose.connection.on('error', DBErrorHandler);
} catch (exception) {
  const message = 'Error occured in bot, shutting down. Check the logs for more information.';
  const error = new Error(exception);

  log({
    message, error, type: OPERATIONAL, transactional: true, severity: ERROR,
  });

  sendAndCloseLogzio();
  process.exit(1);
}
