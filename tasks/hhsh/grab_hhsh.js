/**
 * FIXME:
 * 1. 检查完整性
 */
var requestPromise = require('request-promise');
var cheerio = require('cheerio');
var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var fse = require('fs-extra')
var path = require('path');
var dir = require('node-dir');

var config = require('../../libs/config');
var getAllfileNames = require('../../libs/getAllfileNames');


var baseUrlCreater = function (pageNum) {
  return 'http://www.ximalaya.com/49265909/album/4345263?page='+pageNum;
}
var totalPage = 3;
var basePage = 1;
var writeFilePathInfo = path.resolve(config.rootPath, 'baseRules','hhsh.json');


/**
 * help method
 */
function parseTitle(str) {
  var allowReg = /^(\d{3})【.*】(.*)/;
  var matchArr = allowReg.exec(str);
  var matchInfo = {
    isAllow: false,
    orderNum: -1,
  }
  if (matchArr && matchArr.length) {
    matchInfo.isAllow = true;
    matchInfo.orderNum = Number(matchArr[1]);
    matchInfo.matchStr = matchArr[2];
  }
  return matchInfo;
}
/**
 * 创建 request 以及解析内容
 *  * @return {Promise}
 */

function requestAndParseData(url) {
  return requestPromise(url)
      .then(function (htmlString) {
        var $ = cheerio.load(htmlString);

        var list = []
        $('.album_soundlist ul li').each(function(i, elem) {
          var titleStr = $(this).find('a.title').text().trim();
          var updateTimeStr = $(this).find('.operate span').text().trim();
          var extendAttr = {
            orderNum: -1,
            isAllow: false,
          }

          if (titleStr) {
            var parseObject = parseTitle(titleStr);
            _.merge(extendAttr, parseObject);
          }

          var info = _.merge({
            title: titleStr,
            updateAt: updateTimeStr,
            dateStr: updateTimeStr.replace(/-/g,'').slice(4), //日期
          }, extendAttr);

          list.push(info);
        });

        return list;
      })
      .catch(function (err) {
        console.warn(err);
      });
}

/**
 * 获取所有信息
 * @return {Promise}
 */
function getAllContent() {
  var promiseArr = [];
  for (var i = basePage; i <= totalPage; i++) {
    var url = baseUrlCreater(i);
    promiseArr.push(requestAndParseData(url));
  }

  return Promise.all(promiseArr)
    .then(function (datas) {
      var resultArr = _.flatten(datas);
      var filterArr = _.filter(resultArr, function(item) {
        return item.isAllow;
      })
      return Promise.resolve(filterArr);
    })
}

/**
 * order
 */
function orderList(arr) {
  var sortArr = _.sortBy(arr, function (item) {
    return item.orderNum;
  })
  return sortArr;
}



getAllContent()
  .then(function(arr) {
    return Promise.resolve(orderList(arr))
  })
  .then(function (data) {
    var promiseData = new Promise(function (resolve, reject) {
      fs.writeFile(writeFilePathInfo, JSON.stringify(data, null, 4), function(err) {
        if(err) {
          console.log(err);
          reject(err);
        } else {
          console.log("JSON saved to " + writeFilePathInfo);
          resolve(data);
        }
      });
    });

    var promiseFileName = getAllfileNames('/Users/theone/Downloads/喜马拉雅/');

    return Promise.all([promiseData, promiseFileName]);
  })
  .then(function (resultArr) {
    var dataArr = resultArr[0];
    var filesPath = resultArr[1];
    var files = filesPath.map(function(filePath) {
      var orderNum = '000';
      var dateStr = '0000';
      var fileBaseName = path.basename(filePath);
      var allowReg = /^(\d+).*/;
      var matchArr = allowReg.exec(fileBaseName);

      if (matchArr) {
        var topNum = matchArr[1];
        if (topNum.length === 3) {
          orderNum = topNum
        } else if (topNum.length === 4) {
          dateStr = topNum;
        }
      }

      return {
        fullPath: filePath,
        orderNum: Number(orderNum),
        dateStr: dateStr,
      }
    })

    var count = 0;

    Promise.mapSeries(dataArr, function(item) {
      return new Promise(function (resolve) {
        var matchFile = _.find(files, function(file) {
          var regStr = item.matchStr.replace(/！|，|？|—|“|”/g,'.?');
          var isMatch = new RegExp(regStr).test(file.fullPath);

          // 被修改过
          if (!isMatch) {
            // 特殊处理
            if (file.dateStr !== '0000' && file.dateStr === item.dateStr) {
              isMatch = true;
            } else if (file.orderNum !== 0 && file.orderNum === item.orderNum) {
              isMatch = true;
            }
          }

          return isMatch;
        })

        if (matchFile) {
          var extname = path.extname(matchFile.fullPath);
          var targetFile = '/Users/theone/theone/resources_share/好好说话/' + item.title + extname;
          fse.copySync(matchFile.fullPath, targetFile)

          // console.log('copy Success: ' + targetFile);
          resolve();

        } else {
          count++;
          console.log('Not find: ' + item.title);
          // console.log(item);
          resolve();
        }
      })
    })
    .then(function (){
      console.log('unfind :' + count);
      // console.log(filesPath.slice(200));
    })

  })
;
