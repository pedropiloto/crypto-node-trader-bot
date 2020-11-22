class Product {
  constructor(baseCurrency, quoteCurrenc) {
    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrenc;
    this.productPair = `${baseCurrency}-${quoteCurrenc}`;
    this.productPairFriendlyName = baseCurrency + quoteCurrenc;
  }
}

module.exports = Product;
