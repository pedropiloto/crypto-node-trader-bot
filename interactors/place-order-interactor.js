/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
const Big = require('big.js');
const Bugsnag = require('@bugsnag/js');
const CoinbaseGateway = require('../gateways/coinbase-gateway');
const { TradeModel, STARTED, COMPLETED } = require('../models/trade');
const EstimatePriceInteractor = require('./estimate-price');
const { log } = require('../utils/logger');
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, ERROR_SEVERITY, BUY_ACTION, SELL_ACTION,
} = require('../utils/constants');

const MAX_FUNDS_AMOUNT = 100;

class PlaceOrderInteractor {
  constructor() {
    this.coinbaseGateway = new CoinbaseGateway();
    this.estimatePriceInteractor = new EstimatePriceInteractor();
  }

  async call(productInfo, action, platform, metricValue, force = false) {
    if (action === BUY_ACTION) {
      return this.buy(productInfo, action, platform, metricValue);
    } if (action === SELL_ACTION) {
      return this.sell(productInfo, action, metricValue, force);
    }
    log({
      message: 'unknown action:', type: OPERATIONAL_LOG_TYPE, severity: ERROR_SEVERITY, transactional_event: true,
    });
    return false;
  }

  async buy(productInfo, action, platform, metricValue) {
    let canBuy = false;
    const openTrades = await TradeModel.find(
      { symbol: productInfo.productPair, status: STARTED },
    );
    canBuy = !openTrades.length > 0;
    log({
      message: 'checking if it\'s possible to buy', type: BUSINESS_LOG_TYPE, open_trades_length: openTrades.length, can_buy: canBuy,
    });
    if (canBuy) {
      log({
        message: `placing buy order for ${productInfo.productPair} symbol ${MAX_FUNDS_AMOUNT} funds`,
        type: BUSINESS_LOG_TYPE,
        symbol: productInfo.productPair,
        funds: MAX_FUNDS_AMOUNT,
      });
      const order = await this.coinbaseGateway
        .placeBuyOrder(productInfo.productPair, MAX_FUNDS_AMOUNT);

      log({
        message: 'buy order completed',
        buy_order_id: order.id,
        type: BUSINESS_LOG_TYPE,
        symbol: productInfo.productPair,
        funds: MAX_FUNDS_AMOUNT,
      });
      const buyEstimate = await this.estimatePriceInteractor
        .call(productInfo, action, MAX_FUNDS_AMOUNT, undefined);

      const createdTrade = await TradeModel.create({
        symbol: productInfo.productPair,
        buy_order_id: order.id,
        started_at: Date.now(),
        buy_last_closing_price: buyEstimate.lastClosingPrice.toString(),
        buy_estimated_amount: buyEstimate.amount.toString(),
        buy_estimated_effective_price: buyEstimate.effectiveTotal.toString(),
        buy_metric_value: metricValue,
        platform,
        status: STARTED,
      });
      log({
        message: `created trade ${createdTrade._id} symbol ${MAX_FUNDS_AMOUNT} funds`, type: BUSINESS_LOG_TYPE, trade_id: createdTrade._id, buy_order_id: order.id,
      });

      return true;
    }
    log({
      message: 'not placing order for precaution because the last order was probably not sold yet', type: BUSINESS_LOG_TYPE,
    });
    return false;
  }

  // eslint-disable-next-line class-methods-use-this
  async checkCanSell(openTrade, sellEstimate, metricValue) {
    log({
      message: `Comparing ${openTrade.buy_estimated_effective_price} vs ${sellEstimate.effectiveTotal.toString()}`,
      trade_id: openTrade._id,
      buy_order_id: openTrade.buy_order_id,
      type: BUSINESS_LOG_TYPE,
    });
    const buyEstimatedEffectivePriceBig = new Big(openTrade.buy_estimated_effective_price);
    if (sellEstimate.effectiveTotal.cmp(buyEstimatedEffectivePriceBig) >= 1) {
      log({
        message: 'probably closing trading with profit',
        trade_id: openTrade._id,
        buy_order_id: openTrade.buy_order_id,
        type: BUSINESS_LOG_TYPE,
      });
      return true;
    }
    log({
      message: 'not selling to protect from losing money',
      trade_id: openTrade._id,
      buy_order_id: openTrade.buy_order_id,
      type: BUSINESS_LOG_TYPE,
    });
    const rejectedOrders = openTrade.rejected_sell_orders;
    rejectedOrders.push({
      date: Date.now(),
      market_value: sellEstimate.lastClosingPrice.toString(),
      effective_total: sellEstimate.effectiveTotal.toString(),
      metric_value: metricValue,
    });
    await TradeModel.findOneAndUpdate(
      // eslint-disable-next-line no-underscore-dangle
      { _id: openTrade._id },
      { rejected_sell_orders: rejectedOrders },
    );

    log({
      message: 'update rejected orders successfully',
      trade_id: openTrade._id,
      buy_order_id: openTrade.buy_order_id,
      type: BUSINESS_LOG_TYPE,
    });
    return false;
  }

  async sell(productInfo, action, metricValue, force) {
    const accounts = await this.coinbaseGateway.getAccounts();
    const account = accounts.find((item) => item.currency === productInfo.baseCurrency);
    log({
      message: `checking balance on account: ${account}`, type: BUSINESS_LOG_TYPE,
    });
    let canSell = false;

    const openTrade = await TradeModel.findOne(
      { symbol: productInfo.productPair, status: STARTED },
    );
    if (!openTrade) {
      log({
        message: 'sell order will not be placed since there is no ongoing trade', type: BUSINESS_LOG_TYPE,
      });
      return false;
    }

    const sellEstimate = await this.estimatePriceInteractor
      .call(productInfo, action, undefined, account.available);

    if (!force) {
      canSell = await this.checkCanSell(openTrade, sellEstimate, metricValue);
    }

    if (canSell || force) {
      log({
        message: `placing sell order for ${Number(account.available)} size OF ${productInfo.productPair}`,
        trade_id: openTrade._id,
        buy_order_id: openTrade.buy_order_id,
        size: account.availablle,
        force,
        type: BUSINESS_LOG_TYPE,
      });
      const order = await this.coinbaseGateway
        .placeSellOrder(productInfo.productPair, account.available);

      log({
        message: 'sell order completed',
        trade_id: openTrade._id,
        buy_order_id: openTrade.buy_order_id,
        sell_order_id: order.id,
        type: BUSINESS_LOG_TYPE,
      });
      await TradeModel.findOneAndUpdate({
        symbol: productInfo.productPair,
        status: STARTED,
      }, {
        sell_order_id: order.id,
        sell_last_closing_price: sellEstimate.lastClosingPrice.toString(),
        sell_estimated_effective_price: sellEstimate.effectiveTotal.toString(),
        sell_metric_value: metricValue,
        finished_at: Date.now(),
        status: COMPLETED,
      });

      return true;
    }
    log({
      message: 'order was not placed',
      trade_id: openTrade ? openTrade._id : undefined,
      buy_order_id: openTrade ? openTrade.buy_order_id : undefined,
      type: BUSINESS_LOG_TYPE,
    });
    return false;
  }
}

module.exports = PlaceOrderInteractor;
