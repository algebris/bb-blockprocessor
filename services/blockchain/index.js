const requireAll = require('require-all');

const drivers = requireAll({
  dirname: __dirname,
  recursive: true,
  filter: /^(.+)Driver\.js$/
});

module.exports = drivers;