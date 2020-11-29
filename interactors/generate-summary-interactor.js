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

  async call(productInfo) {
    const result = {};
    const enrichedTrades = [];
    const symbol = productInfo.productPair;

    const completeTrades = await TradeModel.find(
      { symbol, status: COMPLETED },
    );
    const incompleteTrades = await TradeModel.find(
      { symbol, status: STARTED },
    );

    result[symbol] = {};
    // Total Incomplete Trades
    result[symbol].incomplete_trades = incompleteTrades.length;

    for (let i = 0; i < completeTrades.length; i++) {
      const [buyFills, sellFills] = await Promise.all(
        [this.coinbaseGateway.getFillsByOrderId(completeTrades[i].buy_order_id),
          this.coinbaseGateway.getFillsByOrderId(completeTrades[i].sell_order_id),
        ],
      );
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

      // Total Buy
      result[symbol].total_buy = result[symbol].total_buy
        ? ((new Big(result[symbol].total_buy)).add((new Big(totalBuy)))).toString()
        : totalBuy.toString();
      // Total Sell
      result[symbol].total_sell = result[symbol].total_sell
        ? ((new Big(result[symbol].total_sell)).add((new Big(totalSell)))).toString()
        : totalSell.toString();
      // Total Profit
      result[symbol].total_profit = (new Big(result[symbol].total_sell))
        .sub((new Big(result[symbol].total_buy))).toString();
      // Total Buy Fills
      result[symbol].total_buy_fills
        // eslint-disable-next-line no-plusplus
        ? result[symbol].total_buy_fills++
        : result[symbol].total_buy_fills = 1;
      // Total Sell Fiills
      result[symbol].total_sell_fills
        // eslint-disable-next-line no-plusplus
        ? result[symbol].total_sell_fills++
        : result[symbol].total_sell_fills = 1;
      // Total Complete Trades
      result[symbol].complete_trades = enrichedTrades.length;
    });
    return result;
  }
}

module.exports = GenerateSummaryInteractor;
