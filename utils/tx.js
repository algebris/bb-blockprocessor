class Tx {
  constructor(tx) {
    this.tx = tx;
  }
}

module.exports = params => new Tx(params);