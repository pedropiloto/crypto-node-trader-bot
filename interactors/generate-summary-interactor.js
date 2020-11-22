/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-expressions */
const Big = require('big.js');
const CoinbaseGateway = require('../gateways/coinbase-gateway');
const { TradeModel, STARTED, COMPLETED } = require('../models/trade');

class GenerateSummaryInteractor {
  constructor() {
    this.coinbaseGateway = new CoinbaseGateway();
  }

  async call() {
    const result = {};
    const enrichedTrades = [];

    const completeTrades = await TradeModel.find({ status: COMPLETED });
    const incompleteTrades = await TradeModel.find({ status: STARTED });

    for (let i = 0; i < completeTrades.length; i++) {
      const buyFills = await
      this.coinbaseGateway.getFillsByOrderId(completeTrades[i].buy_order_id);
      const sellFills = await
      this.coinbaseGateway.getFillsByOrderId(completeTrades[i].sell_order_id);
      enrichedTrades.push(
        Object.assign(completeTrades[i], { buy_fills: buyFills, sell_fills: sellFills }),
      );
    }

    enrichedTrades.forEach((trade) => {
      const totalBuy = trade.buy_fills.reduce((accumulator, current) => {
        const priceBig = new Big(current.price);
        const sizeBig = new Big(current.size);
        const feeBig = new Big(current.fee);
        const totalCost = priceBig.mul(sizeBig).add(feeBig);
        return new Big(accumulator).add(totalCost);
      }, 0);

      const totalSell = trade.sell_fills.reduce((accumulator, current) => {
        const priceBig = new Big(current.price);
        const sizeBig = new Big(current.size);
        const feeBig = new Big(current.fee);
        const totalCost = priceBig.mul(sizeBig).sub(feeBig);
        return new Big(accumulator).add(totalCost);
      }, 0);

      if (!result[trade.symbol]) result[trade.symbol] = {};
      // Total Buy
      result[trade.symbol].total_buy
        ? result[trade.symbol].total_buy = (
          (new Big(result[trade.symbol].total_buy)).add((new Big(totalBuy)))
        ).toString()
        : result[trade.symbol].total_buy = totalBuy.toString();
      // Total Sell
      result[trade.symbol].total_sell
        ? result[trade.symbol].total_sell = ((
          new Big(result[trade.symbol].total_sell)).add((new Big(totalSell)))
        ).toString()
        : result[trade.symbol].total_sell = totalSell.toString();
      // Total Profit
      result[trade.symbol].total_profit = (new Big(result[trade.symbol].total_sell))
        .sub((new Big(result[trade.symbol].total_buy))).toString();
      // Total Buy Fills
      result[trade.symbol].total_buy_fills
        // eslint-disable-next-line no-plusplus
        ? result[trade.symbol].total_buy_fills++
        : result[trade.symbol].total_buy_fills = 1;
      // Total Sell Fiills
      result[trade.symbol].total_sell_fills
        // eslint-disable-next-line no-plusplus
        ? result[trade.symbol].total_sell_fills++
        : result[trade.symbol].total_sell_fills = 1;
      // Total Complete Trades
      result[trade.symbol].complete_trades = enrichedTrades.length;
      // Total Incomplete Trades
      result[trade.symbol].incomplete_trades = incompleteTrades.length;
    });
    return result;
  }
}

module.exports = GenerateSummaryInteractor;
