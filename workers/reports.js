const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');
const fs = require('fs');
const createDocxReport = require('../engine/reports/docx_group_report').createDocxReport;
const createXlsReport = require('../engine/reports/xls_group_report').createXlsReport;

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let ReportsWorker = function () {};

ReportsWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'start-docx-report-generation':
      createDocxReport(workPackage, callback);
      break;
    case 'start-xls-report-generation':
      createXlsReport(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new ReportsWorker();
