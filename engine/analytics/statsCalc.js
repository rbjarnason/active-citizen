const models = require("../../../models");
const log = require('../../utils/logger');
const toJson = require('../../utils/to_json');
const moment = require('moment');
const _ = require('lodash');

const getPointDomainIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getDomainIncludes(id)
    }
  ]
};

export const getDomainIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      attributes: [],
      include: [
        {
          model: models.Community,
          required: true,
          attributes: [],
          include: [
            {
              model: models.Domain,
              where: { id: id },
              required: true,
              attributes: []
            }
          ]
        }
      ]
    }
  ]
};

const getPointCommunityIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getCommunityIncludes(id)
    }
  ]
};

export const getCommunityIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      attributes: [],
      include: [
        {
          model: models.Community,
          where: { id: id },
          required: true,
          attributes: []
        }
      ]
    }
  ]
};

const getPointGroupIncludes = (id) => {
  return [
    {
      model: models.Post,
      required: true,
      attributes: [],
      include: getGroupIncludes(id)
    }
  ]
};

export const getGroupIncludes = (id) => {
  return [
    {
      model: models.Group,
      required: true,
      where: { id: id },
      attributes: []
    }
  ]
};

export const countModelRowsByTimePeriod = (model, whereOptions, includeOptions, done) => {
  //TODO: Add 5 minute caching
  model.findAll({
    where: whereOptions,
    include: includeOptions,
    attributes: ['created_at'],
    order: [['created_at','ASC']]
  }).then((results) => {
    const startDate = moment(results[0].created_at);
    const endDate = moment(results[results.length-1].created_at);

    const days = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY/MM/DD");
    });

    const months = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY/MM");
    });

    const years = _.groupBy(results, function (item) {
      return moment(item.created_at).format("YYYY");
    });

    const totalDaysCount = endDate.diff(startDate, 'days', false)+2;
    let currentDate =  moment(results[0].created_at);
    let finalDays = [];
    for (let i = 0; i < totalDaysCount; i++) {
      const currentDateText = currentDate.format("YYYY/MM/DD");
      if (days[currentDateText]) {
        finalDays.push({ x: currentDate.format("YYYY-MM-DD"), y: days[currentDateText].length })
      } else {
        //    finalDays.push({ x: currentDate.format("YYYY-MM-DD"), y: 0})
      }
      currentDate = currentDate.add(1, "days");
    }

    const totalMonthsCount = endDate.diff(startDate, 'months', false)+2;
    let currentMonth = moment(results[0].created_at);
    let finalMonths = [];
    for (let i = 0; i < totalMonthsCount; i++) {
      const currentMonthText = currentMonth.format("YYYY/MM");
      if (months[currentMonthText]) {
        finalMonths.push({ x: currentMonth.format("YYYY-MM"), y: months[currentMonthText].length })
      } else {
        //    finalMonths.push({ x: currentMonth.format("YYYY-MM"), y: 0})
      }
      currentMonth = currentMonth.add(1, "months");
    }

    const totalYearsCount = endDate.diff(startDate, 'years', false)+2;
    let currentYear = moment(results[0].created_at);
    let finalYears = [];
    for (let i = 0; i < totalYearsCount; i++) {
      const currentYearText = currentYear.format("YYYY");
      if (years[currentYearText]) {
        finalYears.push({ x: currentYearText, y: years[currentYearText].length })
      } else {
//        finalYears.push({ x: currentYearText, y: 0})
      }
      currentYear = currentYear.add(1, "years");
    }

    done(null, {finalDays, finalMonths, finalYears});
  }).catch((error)=>{
    done(error);
  });
};

/*
countModelRowsByTimePeriod(models.AcActivity, {
  type: {
    $in: [
      "activity.user.login"
    ]
  },
  domain_id: 1
},[], (results) => {
  var a = results;
});

*/