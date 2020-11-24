/* eslint-disable no-console */
const { RSI } = require('technicalindicators');
const CoinbaseGateway = require('../gateways/coinbase-gateway');

class CalculateRSIInteractor {
  constructor(productInfo) {
    this.productInfo = productInfo;
  }

  // eslint-disable-next-line class-methods-use-this
  async call(values) {
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
