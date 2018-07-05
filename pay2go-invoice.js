/**
 * pay2go-invoice
 * reference by Pay2go invoice V.1.1.8 API doc
 * https://cinv.pay2go.com/Invoice_index/download
 */
"use strict";

const request = require('request');
const crypto = require('crypto');
const querystring = require('querystring');

const _testEndPoint = 'https://cinv.pay2go.com/API'; //  測試環境
const _formalEndPoint = 'https://inv.pay2go.com/API'; //  正式環境

//  開立發票
let issue = function (postData, config) {
  return new Promise(function (resolve, reject) {
    //  檢查參數
    checkConfig(config);
    config.API = '/invoice_issue';
    buildRequest(postData, config)
    .then((TransactionInfo) => send(TransactionInfo, config))
    .then((TransactionInfo) => {
      resolve(TransactionInfo);
    })
    .catch((TransactionInfo) => {
      reject(TransactionInfo);
    });
  });
}

//  作廢發票
let invalid = function (postData, config) {
  return new Promise(function (resolve, reject) {
    //  檢查參數
    checkConfig(config);
    config.API = '/invoice_invalid';
    buildRequest(postData, config)
    .then((TransactionInfo) => send(TransactionInfo, config))
    .then((TransactionInfo) => {
      resolve(TransactionInfo);
    })
    .catch((TransactionInfo) => {
      reject(TransactionInfo);
    });
  });
}

//  開立折讓
let allowance = function (postData, config) {
  return new Promise(function (resolve, reject) {
    //  檢查參數
    checkConfig(config);
    config.API = '/allowance_issue';
    buildRequest(postData, config)
    .then((TransactionInfo) => send(TransactionInfo, config))
    .then((TransactionInfo) => {
      resolve(TransactionInfo);
    })
    .catch((TransactionInfo) => {
      reject(TransactionInfo);
    });
  });
}

let buildRequest = function (postData, config) {
  return new Promise(function (resolve, reject) {
    const RequestBody = {};
    RequestBody.MerchantID_ = config.MerchantID;
    RequestBody.PostData_ = encryptParams(querystring.stringify(postData), config); //  AES256 加密
    //  存成 RequestInfo 物件
    let RequestInfo = {};
    RequestInfo.SendDate = `${new Date().toLocaleString()}.${new Date().getMilliseconds()}`;
    RequestInfo.HostURL = config.testMode ? _testEndPoint : _formalEndPoint;
    RequestInfo.API = config.API;
    RequestInfo.QueryString = '';
    RequestInfo.Method = 'POST';
    RequestInfo.Body = RequestBody;
    //  建立 ResponseInfo 物件
    let ResponseInfo = {};
    //  建立 TransactionInfo 物件
    let TransactionInfo = {};
    TransactionInfo.RequestInfo = RequestInfo;
    TransactionInfo.ResponseInfo = ResponseInfo;
    resolve(TransactionInfo);
  });
}

let send = function (TransactionInfo, config) {
  return new Promise(function (resolve, reject) {
    request({
      uri: `${TransactionInfo.RequestInfo.HostURL}${TransactionInfo.RequestInfo.API}`,
      method: TransactionInfo.RequestInfo.Method,
      headers: {
        'Content-type': 'application/json',
        'Accept-Charset': 'utf-8',
      },
      form: TransactionInfo.RequestInfo.Body
    }, function (error, response, body) {
      TransactionInfo.ResponseInfo.ReceiveDate = `${new Date().toLocaleString()}.${new Date().getMilliseconds()}`;
      TransactionInfo.ResponseInfo.Error = error;
      TransactionInfo.ResponseInfo.Body = body;
      if (!error && response.statusCode == 200) {
        TransactionInfo.ResponseInfo.StatusCode = response.statusCode;
        let responseBody = JSON.parse(TransactionInfo.ResponseInfo.Body);
        //  取得錯誤訊息
        if (responseBody.Status !== 'SUCCESS') {
          responseBody.StatusMessage = _errorCode[responseBody.Status];
        }else {
          //  確認檢查碼
          let Result = JSON.parse(responseBody.Result);
          if (Result.CheckCode === CheckCode(Result, config)) {
            responseBody.CheckCode_checkResult = 'valid';
          }else {
            responseBody.CheckCode_checkResult = 'invalid';
          }
        }
        TransactionInfo.ResponseInfo.Body = JSON.stringify(responseBody);
        resolve(TransactionInfo);
      } else {
        reject(TransactionInfo);
      }
    });
  });
}

//  檢查 Config 資料
let checkConfig = function (config) {
  //  檢查設定檔
  if (!config.testMode) throw 'miss test mode choice';
  if (!config.MerchantID) throw 'miss Merchant ID';
  if (!config.HashKey) throw 'miss Hash Key';
  if (!config.HashIV) throw 'miss Hash IV';
}

//  加密參數：使用 AES 256 CBC
let encryptParams = function (postData, config) {
  let cipher = crypto.createCipheriv('aes-256-cbc', config.HashKey, config.HashIV);
  let encryptedData = cipher.update(postData, 'utf8', 'hex') + cipher.final('hex');
  return encryptedData;
}

let CheckCode = function (Result, config) {
  let params = {};
  params.HashIV = config.HashIV;
  params.InvoiceTransNo = Result.InvoiceTransNo ? Result.InvoiceTransNo : '';
  params.MerchantID = Result.MerchantID ? Result.MerchantID : '';
  params.MerchantOrderNo = Result.MerchantOrderNo ? Result.MerchantOrderNo : '';
  params.RandomNum = Result.RandomNum ? Result.RandomNum : '';
  params.TotalAmt = Result.TotalAmt ? Result.TotalAmt : '';
  params.HashKey = config.HashKey;
  let checkCode = crypto.createHash('sha256').update(querystring.stringify(params)).digest('hex').toUpperCase();
  return checkCode;
}

//  官方錯誤代碼對應表
const _errorCode = {
  KEY10002: '資料解密錯誤',
  KEY10004: '資料不齊全',
  KEY10006: '商店未申請啟用電子發票',
  KEY10007: '頁面停留超過 30 分鐘',
  KEY10010: '商店代號空白',
  KEY10011: 'PostData_欄位空白',
  KEY10012: '資料傳遞錯誤',
  KEY10013: '資料空白',
  KEY10014: 'TimeOut',
  KEY10015: '發票金額格式錯誤',
  INV10003: '商品資訊格式錯誤或缺少資料',
  INV10004: '商品資訊的商品小計計算錯誤',
  INV10006: '稅率格式錯誤',
  INV10012: '發票金額、課稅別驗證錯誤',
  INV10013: '發票欄位資料不齊全或格式錯誤',
  INV10014: '自訂編號格式錯誤',
  INV10015: '無未稅金額',
  INV10016: '無稅金',
  INV10017: '輸入的版本不支援混合稅率功能',
  INV20006: '查無發票資料',
  INV70001: '欄位資料格式錯誤',
  INV90005: '未簽定合約或合約已到期',
  INV90006: '可開立張數已用罄',
  NOR10001: '網路連線異常',
  LIB10003: '商店自訂編號重覆',
  LIB10005: '發票已作廢過',
  LIB10007: '無法作廢當該張發票已執行過發票折讓，無法再執行作廢。',
  LIB10008: '超過可作廢期限',
  LIB10009: '發票已開立，但未上傳至財政部，無法作廢；需於開立發票上傳財政部完成後，才可執行作廢。',
}

module.exports = {
  issue: issue,
  invalid: invalid,
  allowance: allowance,
};