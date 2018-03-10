const util = require('util');

module.exports = {
  inspect: obj => util.inspect(obj, { showHidden: true, depth: null })
};
