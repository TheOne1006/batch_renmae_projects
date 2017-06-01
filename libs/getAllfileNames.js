var path = require('path');
var dir = require('node-dir');

/**
 * @param  {string} dirPath
 * @return {Promise}
 */
function getCurrentFiles(dirPath) {
  // dirPath 是否为绝对路径
  return dir.promiseFiles(path.resolve(dirPath))
}

module.exports = getCurrentFiles;
