const CoinbasePro = require('coinbase-pro');
const { RSI, BollingerBands } = require('technicalindicators');
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
const priceArray = [];
const placeOrderInteractor = new PlaceOrderInteractor();

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
    trade(BUY_ACTION, 'BB', value, currentPrice);
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
  websocket.on('message', (data) => {
    if (data.type === 'ticker') {
      const currentPrice = parseFloat(data.price);
      log({
        message: 'Ticker price', current_price: currentPrice, app_name: appName, type: BUSINESS_LOG_TYPE,
      });
      priceArray.push(Number(currentPrice));
      log({
        message: 'Pricings array', length: priceArray.length, app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
      });
      if (priceArray.length >= 600) {
        const rsi = RSI.calculate({
          values: priceArray,
          period: 14,
        });
        log({
          message: 'RSI calculated', rsi_value: rsi[rsi.length - 1], app_name: appName, type: BUSINESS_LOG_TYPE, transactional_event: true,
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
