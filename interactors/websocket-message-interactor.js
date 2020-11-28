const Bugsnag = require('@bugsnag/js');
const util = require('util');
const CalculateRSIInteractor = require('./calculate-rsi-interactor');
const CalculateBBInteractor = require('./calculate-bb-interactor');
const CoinbaseGateway = require('../gateways/coinbase-gateway');
const Product = require('../models/product');
const PlaceOrderInteractor = require('./place-order-interactor');
const { log, sendAndCloseLogzio } = require('../utils/logger');
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, ERROR_SEVERITY, BUY_ACTION, SELL_ACTION,
} = require('../utils/constants');

const baseCurrency = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrency = `${process.env.QUOTE_CURRENCY_NAME}`;

const productInfo = new Product(
  baseCurrency, quoteCurrency,
);

const calculateRSIInteractor = new CalculateRSIInteractor(productInfo);
const calculateBBInteractor = new CalculateBBInteractor(productInfo);
const coinbaseGateway = new CoinbaseGateway();

const placeOrderInteractor = new PlaceOrderInteractor();

async function trade(action, metric, value, currentPrice) {
  try {
    const success = await placeOrderInteractor.call(
      productInfo, action, 'consumer', value,
    );
    if (success) {
      log({
        message: 'sucessfully requested an order', action, status: true, metric, value, current_price: currentPrice, type: BUSINESS_LOG_TYPE, transactional: true,
      });
    } else {
      log({
        message: 'unsuccessful order', action, status: false, metric, value, type: BUSINESS_LOG_TYPE, transactional: true,
      });
    }
  } catch (error) {
    log({
      message: `Error during trade operation: ${error.stack}`,
      error,
      type: OPERATIONAL_LOG_TYPE,
      transactional: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(util.inspect(error));
  }
}

function analyseRSI(value, currentPrice) {
  if (value <= 30) {
    trade(BUY_ACTION, 'RSI', value, currentPrice);
  } else if (value >= 66) {
    trade(SELL_ACTION, 'RSI', value, currentPrice);
  }
}

function analyseUpperBB(differencePercentage, currentPrice) {
  if (differencePercentage > 1) {
    trade(SELL_ACTION, 'BB', differencePercentage, currentPrice);
  }
}

module.exports = async (data) => {
  if (data.type === 'ticker') {
    const currentPrice = parseFloat(data.price);
    log({
      message: 'Ticker price', current_price: currentPrice, type: BUSINESS_LOG_TYPE,
    });
    log({
      message: 'Delaying analysing Ticker price', current_price: currentPrice, type: BUSINESS_LOG_TYPE,
    });
    await (new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }));
    let values;
    try {
      values = (
        await coinbaseGateway.getCandlesOneMinute(productInfo.productPair)
      ).map((x) => x.close);
    } catch (error) {
      log({
        message: `Error during fetching candles. Shuting down to prevent more errors: ${error.stack}`,
        type: OPERATIONAL_LOG_TYPE,
        transactional: true,
        severity: ERROR_SEVERITY,
      });
      Bugsnag.notify(new Error(util.inspect(error)));
      sendAndCloseLogzio();
      process.exit(1);
    }
    if (values) {
      try {
        const rsiValue = await calculateRSIInteractor.call(values);

        log({
          message: 'RSI calculated', rsi_value: Number(rsiValue), type: BUSINESS_LOG_TYPE, transactional: true,
        });
        analyseRSI(rsiValue, currentPrice);
      } catch (error) {
        log({
          message: 'Error during RSI analysis',
          type: OPERATIONAL_LOG_TYPE,
          transactional: true,
          severity: ERROR_SEVERITY,
        });
        Bugsnag.notify(util.inspect(new Error(error)));
      }
      try {
        const bbValue = await calculateBBInteractor.call(values);
        if (bbValue) {
          const difference = (
            Number(currentPrice) - Number(bbValue.upper)
          );
          const differencePercentage = (difference / Number(bbValue.upper)) * 100;
          analyseUpperBB(differencePercentage, currentPrice);
          log({
            message: 'BB calculated', upper_bb_value: bbValue.upper, current_price: currentPrice, difference_percentage: differencePercentage, type: BUSINESS_LOG_TYPE, transactional: true,
          });
        }
      } catch (error) {
        log({
          message: 'Error during BB analysis',
          type: OPERATIONAL_LOG_TYPE,
          transactional: true,
          severity: ERROR_SEVERITY,
        });
      }
    }
  }
};
