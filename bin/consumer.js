const CoinbasePro = require('coinbase-pro');

require('dotenv').config();
const Bugsnag = require('@bugsnag/js');
const mongoose = require('../config/database');
const { log, sendAndCloseLogzio } = require('../utils/logger');
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, ERROR_SEVERITY, BUY_ACTION, SELL_ACTION,
} = require('../utils/constants');
const PlaceOrderInteractor = require('../interactors/place-order-interactor');

const { memoryMetric, cpuUsageMetric } = require('../metric');
const Product = require('../models/product');
const CalculateRSIInteractor = require('../interactors/calculate-rsi-interactor');
const CalculateBBInteractor = require('../interactors/calculate-bb-interactor');

const key = `${process.env.API_KEY}`;
const secret = `${process.env.API_SECRET}`;
const passphrase = `${process.env.API_PASSPHRASE}`;
const baseCurrency = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrency = `${process.env.QUOTE_CURRENCY_NAME}`;
const appName = `${process.env.APP_NAME}`;

// const websocketURI = "wss://ws-feed.pro.coinbase.com";
// const websocketURI = "wss://ws-feed-public.sandbox.pro.coinbase.com";
const websocketURI = `${process.env.WEB_SOCKET_URI}`;

const productInfo = new Product(
  baseCurrency, quoteCurrency,
);
const placeOrderInteractor = new PlaceOrderInteractor();
const calculateRSIInteractor = new CalculateRSIInteractor(productInfo);
const calculateBBInteractor = new CalculateBBInteractor(productInfo);

async function trade(action, metric, value, currentPrice) {
  try {
    const success = await placeOrderInteractor.call(
      productInfo, action, 'consumer', value,
    );
    if (success) {
      log({
        message: 'sucessfully requested an order', action, status: success, metric, value, current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
      });
    } else {
      log({
        message: 'unsuccessful order', action, status: success, metric, value, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
      });
    }
  } catch (error) {
    log({
      message: `Error during trade operation: ${error.stack}`,
      error,
      type: OPERATIONAL_LOG_TYPE,
      transactional_event: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(error);
  }
}

function analyseRSI(value, currentPrice) {
  if (value <= 30) {
    trade(BUY_ACTION, 'RSI', value, currentPrice);
  } else if (value >= 66) {
    trade(SELL_ACTION, 'RSI', value, currentPrice);
  }
}

function analyseUpperBB(value, currentPrice) {
  if (currentPrice > value) {
    trade(SELL_ACTION, 'BB', value, currentPrice);
  }
}

/**
 * Creates the websocket object and turns it on to update the currentPrice
 *
 * @param {string} productPair
 */
function listenForPriceUpdates(productPair) {
  if (productPair == null) {
    const error = new Error('Error in listenForPriceUpdates method. ProductPair is null!');
    Bugsnag.notify(error);
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
  websocket.on('error', (err) => {
    const message = 'Error occured in the websocket.';
    const errorMsg = new Error(err);
    log({
      message,
      error: errorMsg,
      type: OPERATIONAL_LOG_TYPE,
      transactional_event: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(errorMsg);
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for closes to restart it
  websocket.on('close', () => {
    log({
      message: 'WebSocket closed, restarting...', type: OPERATIONAL_LOG_TYPE, transactional_event: true, severity: ERROR_SEVERITY,
    });
    listenForPriceUpdates(productPair);
  });

  // Turn on the websocket for messages
  websocket.on('message', async (data) => {
    if (data.type === 'ticker') {
      const currentPrice = parseFloat(data.price);
      log({
        message: 'Ticker price', current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE,
      });

      const rsiValue = await calculateRSIInteractor.call();

      log({
        message: 'RSI calculated', rsi_value: Number(rsiValue), app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
      });
      analyseRSI(rsiValue, currentPrice);
      const bbValue = await calculateBBInteractor.call();
      if (bbValue) {
        analyseUpperBB(bbValue.upper, currentPrice);
      }

      log({
        message: 'BB calculated', bb_value: bbValue, app_name: appName, type: BUSINESS_LOG_TYPE,
      });
    }
  });
}

try {
  log({
    message: 'starting', app_name: appName, type: OPERATIONAL_LOG_TYPE, transactional_event: true,
  });
  // activate websocket for price data:
  listenForPriceUpdates(productInfo.productPair);
  if (process.env.NODE_ENV === 'production') {
    memoryMetric();
    cpuUsageMetric();
    Bugsnag.start({ apiKey: `${process.env.BUSGNAG_API_KEY}` });
  }
  mongoose.connection.on(
    'error',
    () => {
      log({
        message: 'MongoDB connection error',
        app_name: appName,
        type: OPERATIONAL_LOG_TYPE,
        transactional_event: true,
        severity: ERROR_SEVERITY,
      });
      Bugsnag.notify(new Error('MongoDB connection error'));
    },

  );
} catch (error) {
  const message = 'Error occured in bot, shutting down. Check the logs for more information.';
  const errorMsg = new Error(error);
  log({
    message,
    error: errorMsg,
    app_name: appName,
    type: OPERATIONAL_LOG_TYPE,
    transactional_event: true,
    severity: ERROR_SEVERITY,
  });
  sendAndCloseLogzio();
  process.exit(1);
}
