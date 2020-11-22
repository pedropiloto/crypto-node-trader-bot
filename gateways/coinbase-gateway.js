/* eslint-disable no-console */
const {
  CoinbasePro, OrderSide, OrderType, CandleGranularity, FeeUtil,
} = require('coinbase-pro-node');
const Big = require('big.js');
const { log } = require('../utils/logger');

const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, BUY_ACTION,
} = require('../utils/constants');

class CoinbaseGateway {
  constructor() {
    const useSandbox = process.env.USE_SANDBOX === 'true';
    log({
      message: `creating client to ${useSandbox ? 'sandbox' : 'production'} account`, type: OPERATIONAL_LOG_TYPE, transactional_event: true,
    });

    this.client = new CoinbasePro(
      {
        apiKey: process.env.API_KEY,
        apiSecret: process.env.API_SECRET,
        passphrase: process.env.API_PASSPHRASE,
        useSandbox,
      },
    );
  }

  getAccounts() {
    return this.client.rest.account.listAccounts();
  }

  placeBuyOrder(productId, funds) {
    return this.client.rest.order.placeOrder({
      product_id: productId,
      side: OrderSide.BUY,
      funds,
      type: OrderType.MARKET,
    });
  }

  placeSellOrder(productId, size) {
    return this.client.rest.order.placeOrder({
      product_id: productId,
      side: OrderSide.SELL,
      size,
      type: OrderType.MARKET,
    });
  }

  async getFillsByOrderId(orderId) {
    const fills = [];
    let fetchResult = await this.client.rest.fill.getFillsByOrderId(orderId);
    fills.push(...fetchResult.data);
    while (fetchResult.pagination.after) {
      // eslint-disable-next-line no-await-in-loop
      fetchResult = await this.client.rest.fill.getFillsByOrderId(orderId, {
        after: fetchResult.pagination.after,
      });
      if (fetchResult.data.length > 0) {
        log({
          message: `warning!! more than 100 fills, maybe it would be nice to check the order_id: ${orderId}`, type: BUSINESS_LOG_TYPE,
        });
        fills.push(...fetchResult.data);
      }
    }
    return fills;
  }

  getCandles(symbol) {
    return this.client.rest.product.getCandles(symbol, {
      granularity: CandleGranularity.FIFTEEN_MINUTES,
    });
  }

  getCurrentFees() {
    return this.client.rest.fee.getCurrentFees();
  }

  async getEstimatePrice(productInfo, action, funds, amount) {
    const candles = await this.getCandles(productInfo.productPair);
    const lastClosingPrice = candles[candles.length - 1].close;

    log({
      message: `last closing price ${lastClosingPrice}`, type: BUSINESS_LOG_TYPE,
    });

    const feeTier = await this.getCurrentFees();

    let productAmount;
    const lastClosingPriceBig = new Big(lastClosingPrice);
    if (action === BUY_ACTION) {
      const fundsBig = new Big(funds);
      // calculate based on the funds
      productAmount = fundsBig.div(lastClosingPrice);
    } else {
      // the amount available in the portfolio
      productAmount = amount;
    }
    const estimatedFee = FeeUtil.estimateFee(
      productAmount,
      lastClosingPrice,
      action === BUY_ACTION ? OrderSide.BUY : OrderSide.SELL,
      OrderType.MARKET,
      feeTier,
      productInfo.baseCurrency,
    );

    return {
      amount: productAmount,
      lastClosingPrice: lastClosingPriceBig,
      effectiveTotal: estimatedFee.effectiveTotal,
    };
  }
}

module.exports = CoinbaseGateway;
