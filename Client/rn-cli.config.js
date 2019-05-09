const blacklist = require('metro-config/src/defaults/blacklist');
var config =
{
  getBlacklistRE(platform)
  {
    return blacklist(platform,[/react\-native\-nw\-react\-calculator.+\/node_modules\/fbjs.*/]);
  }
};
module.exports = config;