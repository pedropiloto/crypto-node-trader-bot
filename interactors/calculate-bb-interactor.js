/* eslint-disable no-console */
const { BollingerBands } = require('technicalindicators');
const CoinbaseGateway = require('../gateways/coinbase-gateway');

class CalculateBBInteractor {
  constructor(productInfo) {
    this.productInfo = productInfo;
    this.coinbaseGateway = new CoinbaseGateway();
  }

  async call() {
    // based on one minute interval candles
    const values = (
      await this.coinbaseGateway.getCandles(this.productInfo.productPair)
    ).map((x) => x.close);
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
