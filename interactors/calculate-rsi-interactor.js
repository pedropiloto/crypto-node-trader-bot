/* eslint-disable no-console */
const { RSI } = require('technicalindicators');
const CoinbaseGateway = require('../gateways/coinbase-gateway');

class CalculateRSIInteractor {
  constructor(productInfo) {
    this.productInfo = productInfo;
    this.coinbaseGateway = new CoinbaseGateway();
  }

  async call() {
    // based on one minute interval candles
    const values = (
      await this.coinbaseGateway.getCandlesOneMinute(this.productInfo.productPair)
    ).map((x) => x.close);
    const rsiArray = RSI.calculate({
      values,
      period: 14,
    });
    const rsiValue = rsiArray[rsiArray.length - 1];
    console.log('rsi:', rsiValue);
    return rsiValue;
  }
}

module.exports = CalculateRSIInteractor;
