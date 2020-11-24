/* eslint-disable no-console */
const { BollingerBands } = require('technicalindicators');
const CoinbaseGateway = require('../gateways/coinbase-gateway');

class CalculateBBInteractor {
  constructor(productInfo) {
    this.productInfo = productInfo;
    this.coinbaseGateway = new CoinbaseGateway();
  }

  // eslint-disable-next-line class-methods-use-this
  async call(values) {
    const bbArray = BollingerBands.calculate({
      period: 14,
      values,
      stdDev: 2,
    });
    const bbValue = bbArray[bbArray.length - 1];
    console.log('bb:', bbValue);
    return bbValue;
  }
}

module.exports = CalculateBBInteractor;
