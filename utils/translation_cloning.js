const models = require('../../models');
const async = require('async');
const ip = require('ip');
const _ = require('lodash');
const fs = require('fs');
const request = require('request');
const farmhash = require('farmhash');
const fixTargetLocale = require('translation_helpers').fixTargetLocale;

// For post get translations in all locales (that exists)
// select * from translation_cache where index_key LIKE 'communityContent-728-%-3536451109';
// Clone them with the new post id
// Same
// Domains
// Communities
// Groups
// Points


const addItem = (targetLocale, items, textType, id, content, done) => {
  if (!content) {
    done();
  } else {
    const indexKey = `${textType}-${id}-${fixTargetLocale(targetLocale)}-${farmhash.hash32(content).toString()}`;
    models.AcTranslationCache.findOne({
      where: {
        index_key: indexKey
      }
    }).then((result) => {
      const item = {};
      item.textType = textType;
      item.contentId = id;
      item.originalText = content;
      item.indexKey = indexKey;
      if (result) {
        item.translatedText = result.content;
      }
      items.push(item);
      done();
    }).catch((error)=>{
      done(error);
    });
  }
};

const addTranslationsForPosts = (targetLocale, items, posts, done) => {
  async.forEachSeries(posts, (post, forEachCallback) => {
    addItem(targetLocale, items, 'postName', post.id, post.name, (error) => {
      if (error) {
        forEachCallback(error)
      } else {
        addItem(targetLocale, items,'postContent', post.id, post.description, (error) => {
          forEachCallback(error);
        });
      }
    });
  }, error => {
    done(error);
  })
};

const addTranslationsForGroups = (targetLocale, items, groups, done) => {
  async.forEachSeries(groups, (group, forEachCallback) => {
    addItem(targetLocale, items, 'groupName', group.id, group.name, (error) => {
      if (error) {
        forEachCallback(error)
      } else {
        addItem(targetLocale, items, 'groupContent', group.id, group.objectives, (error) => {
          forEachCallback(error);
        });
      }
    });
  }, error => {
    done(error);
  })
};

const addTranslationsForCommunity = (targetLocale, items, community, done) => {
  addItem(targetLocale, items, 'communityName', community.id, community.name, (error) => {
    if (error) {
      done(error)
    } else {
      addItem(targetLocale, items, 'communityContent', community.id, community.description, (error) => {
        done(error);
      });
    }
  });
};

const getTranslatedTextsForCommunity = (targetLocale, communityId, done) => {
  const communityItems = [];
  const groupItems = [];
  const postItems = [];

  async.parallel([
    (seriesCallback) => {
      async.series([
        (innerSeriesCallback) => {
          models.Post.findAll({
            attributes: ['id','name','description'],
            include: [
              {
                model: models.Group,
                attributes: ['id'],
                include: [
                  {
                    model: models.Community,
                    attributes: ['id'],
                    where: {
                      id: communityId
                    }
                  }
                ]
              }
            ]
          }).then(posts=>{
            addTranslationsForPosts(targetLocale, postItems, posts, innerSeriesCallback);
          }).catch(error=>{
            innerSeriesCallback(error);
          })
        },
        (innerSeriesCallback) => {
          models.Group.findAll({
            attributes: ['id','name','objectives'],
            where: {
              community_id: communityId
            }
          }).then(groups=>{
            addTranslationsForGroups(targetLocale, groupItems, groups, innerSeriesCallback);
          }).catch(error=>{
            innerSeriesCallback(error);
          })
        },
        (innerSeriesCallback) => {
          models.Community.findOne({
            attributes: ['id','name','description'],
            where: {
              id: communityId
            }
          }).then(community=>{
            addTranslationsForCommunity(targetLocale, communityItems, community, innerSeriesCallback);
          }).catch(error=>{
            innerSeriesCallback(error);
          })
        }
      ], (error) => {
        seriesCallback(error);
      })
    },
  ], error => {
    if (error) {
      done(null, error);
    } else {
      done(communityItems.concat(groupItems.concat(postItems)));
    }
  });
}

const getTranslatedTextsForGroup = (targetLocale, groupId, done) => {
  const groupItems = [];
  const postItems = [];

  async.parallel([
    (seriesCallback) => {
      async.series([
        (innerSeriesCallback) => {
          models.Post.findAll({
            attributes: ['id','name','description'],
            include: [
              {
                model: models.Group,
                attributes: ['id'],
                where: {
                  id: groupId
                }
              }
            ]
          }).then(posts=>{
            addTranslationsForPosts(targetLocale, postItems, posts, innerSeriesCallback);
          }).catch(error=>{
            innerSeriesCallback(error);
          })
        },
        (innerSeriesCallback) => {
          models.Group.findAll({
            attributes: ['id','name','objectives'],
            where: {
              id: groupId
            }
          }).then(groups=>{
            addTranslationsForGroups(targetLocale, groupItems, groups, innerSeriesCallback);
          }).catch(error=>{
            innerSeriesCallback(error);
          })
        }
      ], (error) => {
        seriesCallback(error);
      })
    },
  ], error => {
    if (error) {
      done(null, error);
    } else {
      done(groupItems.concat(postItems));
    }
  });
}

const updateTranslation = (item, done) => {
  let targetLocale = fixTargetLocale(item.targetLocale);

  const indexKey = `${item.textType}-${item.contentId}-${targetLocale}-${farmhash.hash32(item.content).toString()}`;
  models.AcTranslationCache.findOrCreate({
    where: {
      index_key: indexKey
    },
    defaults: {
      index_key: indexKey,
      content: item.translatedText
    }
  }).then((result) => {
    if (result && result.length>0) {
      result[0].content = item.translatedText;
      result[0].save().then(()=>{
        done();
      }).catch(error => seriesCallback(error));
    } else {
      seriesCallback("Cant find or create translation");
    }
  }).catch(error => done(error));
}

const updateTranslationForGroup = (groupId, item, done) => {
  async.series([
    (seriesCallback) => {
      if (["groupName","groupContent"].indexOf(item.textType)>-1) {
        seriesCallback(groupId==item.contentId ? null : 'Access denied')
      } else {
        seriesCallback();
      }
    },
    (seriesCallback) => {
      if (["postName","postContent"].indexOf(item.textType)>-1) {
        models.Post.findOne({
          where: {
            id: item.contentId
          },
          attributes: ["id"],
          include: [
            {
              model: models.Group,
              required: true,
              where: { id: groupId }
            }
          ]
        }).then( post => {
          seriesCallback( post ? null : 'Access denied')
        }).catch(error => seriesCallback(error));
      } else {
        seriesCallback();
      }
    },
    (seriesCallback) => {
      updateTranslation(item, seriesCallback);
    },
  ], error => {
    done(error);
  })
};

const updateTranslationForCommunity = (communityId, item, done) => {
  async.series([
    (seriesCallback) => {
      if (["communityName","communityContent"].indexOf(item.textType)>-1) {
        seriesCallback(communityId==item.contentId ? null : 'Access denied')
      } else {
        seriesCallback();
      }
    },
    (seriesCallback) => {
      if (["groupName","groupContent"].indexOf(item.textType)>-1) {
        models.Group.findOne({
          where: {
            id: item.contentId
          },
          attributes: ["id"],
          include: [
            {
              model: models.Community,
              where: { id: communityId },
              required: true
            }
          ]
        }).then( group => {
          seriesCallback( group ? null : 'Access denied')
        }).catch(error => seriesCallback(error));
      } else {
        seriesCallback();
      }
    },
    (seriesCallback) => {
      if (["postName","postContent"].indexOf(item.textType)>-1) {
        models.Post.findOne({
          where: {
            id: item.contentId
          },
          attributes: ["id"],
          include: [
            {
              model: models.Group,
              required: true,
              include: [
                {
                  model: models.Community,
                  where: { id: communityId },
                  required: true
                }
              ]
            }
          ]
        }).then( post => {
          seriesCallback( post ? null : 'Access denied')
        }).catch(error => seriesCallback(error));
      } else {
        seriesCallback();
      }
    },
    (seriesCallback) => {
      updateTranslation(item, seriesCallback);
    },
  ], error => {
    done(error);
  })
};

module.exports = {
  getTranslatedTextsForCommunity,
  getTranslatedTextsForGroup,
  updateTranslationForCommunity,
  updateTranslationForGroup
};
