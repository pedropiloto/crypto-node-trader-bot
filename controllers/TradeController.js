const Bugsnag = require('@bugsnag/js');
const util = require('util');
const GenerateSummaryInteractor = require('../interactors/generate-summary-interactor');
const LookupTradesInteractor = require('../interactors/lookup-trades-interactor');
const { log } = require('../utils/logger');
const {
  BUSINESS_LOG_TYPE, OPERATIONAL_LOG_TYPE, ERROR_SEVERITY, BUY_ACTION, SELL_ACTION,
} = require('../utils/constants');
const { validateExecuteTradeRequest } = require('../utils/validate-execute-trade-request');
const Product = require('../models/product');
const PlaceOrderInteractor = require('../interactors/place-order-interactor');

const baseCurrency = `${process.env.BASE_CURRENCY_NAME}`;
const quoteCurrency = `${process.env.QUOTE_CURRENCY_NAME}`;

const productInfo = new Product(
  baseCurrency, quoteCurrency,
);

const getAll = async (req, res) => {
  const lookupTradesInteractor = new LookupTradesInteractor();
  try {
    const trades = await lookupTradesInteractor.call(productInfo);
    res.status(200).json(trades);
  } catch (error) {
    res.status(500).status({ error: error.stack });
    log({
      message: `error fetching trades: ${error.stack}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(util.inspect(error));
  }
};

const execute = async (req, res) => {
  try {
    if (validateExecuteTradeRequest(req.body) === false) res.status(400).json({ error: 'Invalid Arguments' });

    const placeOrderInteractor = new PlaceOrderInteractor();
    const action = req.body.action === SELL_ACTION ? SELL_ACTION : BUY_ACTION;
    const force = req.body.force ? req.body.force : false;
    const success = await placeOrderInteractor.call(
      productInfo, action, 'web', req.body.value, force,
    );

    if (success) {
      log({
        message: 'sucessfully requested order', action, status: success, metric: req.body.metric, value: req.body.value, type: BUSINESS_LOG_TYPE, transactional: true,
      });
    } else {
      log({
        message: 'unsuccessful order', action, status: success, metric: req.body.metric, value: req.body.value, type: BUSINESS_LOG_TYPE, transactional: true,
      });
    }

    res.status(200).json({
      success,
      message: `${req.body.action} order for ${productInfo.productPair} ${success ? 'fullfilled' : 'not fullfilled'}`,
    });
  } catch (error) {
    res.status(500).status({ error: error.stack });
    log({
      message: `error fetching trades: ${error.stack}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(util.inspect(error));
  }
};

const summary = async (req, res) => {
  const generateSummaryInteractor = new GenerateSummaryInteractor();
  try {
    const result = await generateSummaryInteractor.call(productInfo);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).status({ error: error.stack });
    log({
      message: `error fetching summary: ${error.stack}`,
      type: OPERATIONAL_LOG_TYPE,
      transactional: true,
      severity: ERROR_SEVERITY,
    });
    Bugsnag.notify(util.inspect(error));
  }
};

module.exports = { getAll, summary, execute };
