const CoinbaseGateway = require('../gateways/coinbase-gateway');
const { TradeModel } = require('../models/trade');

class LookupTradesInteractor {
  constructor() {
    this.coinbaseGateway = new CoinbaseGateway();
  }

  // eslint-disable-next-line class-methods-use-this
  call(productInfo) {
    return TradeModel.find({ symbol: productInfo.productPair });
  }
}

module.exports = LookupTradesInteractor;
