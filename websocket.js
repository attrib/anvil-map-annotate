const webSocket = require("ws");
const sessionParser = require("./lib/session");
const wss = new webSocket.Server({clientTracking: false, noServer: true});
const clients = new Map();
const fs = require('fs');
const uuid = require('uuid')
const {hasAccess, ACL_ACTIONS, ACL_READ} = require("./lib/ACLS");
const warapi = require('./lib/warapi')
const eventLog = require('./lib/eventLog')
const sanitizeHtml = require("sanitize-html");
const {loadFeatures, saveFeatures, loadHeatmap, saveHeatmap} = require("./lib/featureLoader");

const features = loadFeatures()
const heatMapFeatures = loadHeatmap()

const sanitizeOptions = {
  allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'p', 'img', 'video', 'source' ],
  allowedAttributes: {
    'a': [ 'href', 'title' ],
    'img': [ 'src', 'alt', 'title', 'width', 'height' ],
    'video': [ 'width', 'height' ],
    'source': [ 'src', 'type' ],
  },
};
const sanitizeOptionsClan = {
  allowedTags: [ ],
  allowedAttributes: { },
};

wss.on('connection', function (ws, request) {
    const username = request.session?.user;
    const userId = request.session?.userId;
    const discordId = request.session?.discordId;
    const acl = request.session?.acl ? request.session?.acl : ACL_READ;
    const wsId = uuid.v4();
    clients.set(wsId, ws);

    ws.send(JSON.stringify({
      type: 'init',
      data: {
        acl,
        version: process.env.COMMIT_HASH,
        warStatus: warapi.warData.status,
        featureHash: features.hash,
        heatMaps: Object.keys(heatMapFeatures),
      }
    }));

    //connection is up, let's add a simple event
    ws.on('message', (message) => {
      const oldHash = features.hash
      message = JSON.parse(message);
      switch (message.type) {
        case 'init':
          if (message.data.featureHash !== features.hash) {
            sendFeatures(ws)
          }
          break;

        case 'getAllFeatures':
          sendFeatures(ws)
          break;

        case 'featureAdd':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          const feature = message.data;
          if (!hasAccess(userId, acl, ACL_ACTIONS.ICON_ADD, feature)) {
            return;
          }
          feature.id = uuid.v4()
          feature.properties.id = feature.id
          feature.properties.user = username
          feature.properties.userId = userId
          feature.properties.discordId = discordId
          feature.properties.time = (new Date()).toISOString()
          feature.properties.notes = sanitizeHtml(feature.properties.notes, sanitizeOptions)
          if (feature.properties.color) {
            feature.properties.color = sanitizeHtml(feature.properties.color, sanitizeOptionsClan)
          }
          if (feature.properties.clan) {
            feature.properties.clan = sanitizeHtml(feature.properties.clan, sanitizeOptionsClan)
          }
          if (feature.properties.lineType) {
            feature.properties.lineType = sanitizeHtml(feature.properties.lineType, sanitizeOptionsClan)
          }
          features.features.push(feature)
          eventLog.logEvent({type: message.type, user: username, userId, data: message.data})
          saveFeatures(features)
          sendUpdateFeature('add', feature, oldHash, features.hash)
          break;

        case 'featureUpdate':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          let editFeature = null
          for (const existingFeature of features.features) {
            if (message.data.properties.id === existingFeature.properties.id) {
              editFeature = existingFeature
              if (!hasAccess(userId, acl, ACL_ACTIONS.ICON_EDIT, existingFeature)) {
                return;
              }
              existingFeature.properties = message.data.properties
              if (!existingFeature.properties.discordId) {
                existingFeature.properties.discordId = discordId
              }
              existingFeature.properties.muser = username
              existingFeature.properties.muserId = userId
              existingFeature.properties.time = (new Date()).toISOString()
              existingFeature.properties.notes = sanitizeHtml(existingFeature.properties.notes, sanitizeOptions)
              if (existingFeature.properties.color) {
                existingFeature.properties.color = sanitizeHtml(existingFeature.properties.color, sanitizeOptionsClan)
              }
              if (existingFeature.properties.clan) {
                existingFeature.properties.clan = sanitizeHtml(existingFeature.properties.clan, sanitizeOptionsClan)
              }
              if (existingFeature.properties.lineType) {
                existingFeature.properties.lineType = sanitizeHtml(existingFeature.properties.lineType, sanitizeOptionsClan)
              }
              existingFeature.geometry = message.data.geometry
              eventLog.logEvent({type: message.type, user: username, userId, data: message.data})
            }
          }
          saveFeatures(features);
          if (editFeature) {
            sendUpdateFeature('update', editFeature, oldHash, features.hash)
          }
          break;

        case 'featureDelete':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          const featureToDelete = features.features.find((value) => value.properties.id === message.data.id)
          if (!hasAccess(userId, acl, ACL_ACTIONS.ICON_DELETE, featureToDelete)) {
            return;
          }
          features.features = features.features.filter((feature) => {
            if (feature.properties.id === message.data.id) {
              eventLog.logEvent({type: message.type, user: username, userId, data: feature})
            }
            return feature.properties.id !== message.data.id
          })
          saveFeatures(features)
          sendUpdateFeature('delete', featureToDelete, oldHash, features.hash)
          break;

        case 'ping':
          ws.send(JSON.stringify({type: 'pong'}))
          break;

        case 'decayUpdate':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          if (!hasAccess(userId, acl, ACL_ACTIONS.DECAY_UPDATE)) {
            return;
          }
          for (const feature of features.features) {
            if (feature.properties.id === message.data.id) {
              feature.properties.time = (new Date()).toISOString()
              feature.properties.muser = username
              feature.properties.muserId = userId
              eventLog.logEvent({type: message.type, user: username, userId, data: message.data})
              sendDataToAll('decayUpdated', {
                id: feature.properties.id,
                type: feature.properties.type,
                time: feature.properties.time,
              })
            }
          }
          saveFeatures(features)
          break;

        case 'flag':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          let flagged = false;
          for (const feature of features.features) {
            if (feature.properties.id === message.data.id) {
              if (!feature.properties.flags) {
                feature.properties.flags = [userId]
              }
              else if (feature.properties.flags.includes(userId)) {
                feature.properties.flags.splice(feature.properties.flags.indexOf(userId), 1)
              }
              else {
                feature.properties.flags.push(userId)
              }
              eventLog.logEvent({type: message.type, user: username, userId, data: message.data})
              flagged = true;
              sendDataToAll('flagged', {
                id: feature.properties.id,
                type: feature.properties.type,
                flags: feature.properties.flags,
              })
            }
          }
          if (flagged) {
            saveFeatures(features)
          }
          break;

        case 'unflag':
          if (warapi.warData.status === warapi.WAR_RESISTANCE) {
            break;
          }
          if (!hasAccess(userId, acl, ACL_ACTIONS.UNFLAG)) {
            return;
          }
          for (const feature of features.features) {
            if (feature.properties.id === message.data.id) {
              feature.properties.flags = [];
              eventLog.logEvent({type: message.type, user: username, userId, data: message.data})
              sendDataToAll('flagged', {
                id: feature.properties.id,
                type: feature.properties.type,
                flags: feature.properties.flags,
              })
              saveFeatures(features)
            }
          }
          break;

        case 'heatMapFeature':
          const heatFeature = message.data;
          let type = heatFeature.properties.type;
          if (heatFeature.properties.icon) {
            type = type + '-' + heatFeature.properties.icon;
          }
          if (!(type in heatMapFeatures)) {
            heatMapFeatures[type] = {
              type: 'FeatureCollection',
              features: []
            };
            sendDataToAll('heatmaps.newType', type);
          }
          heatFeature.properties.time = (new Date()).toISOString()
          heatFeature.properties.weight = 1
          delete heatFeature.id
          delete heatFeature.properties.id
          delete heatFeature.properties.notes
          delete heatFeature.properties.color
          delete heatFeature.properties.clan
          delete heatFeature.properties.lineType
          delete heatFeature.properties.user
          delete heatFeature.properties.userId
          delete heatFeature.properties.discordId
          delete heatFeature.properties.muser
          delete heatFeature.properties.muserId
          heatMapFeatures[type].features.push(heatFeature);
          saveHeatmap(heatMapFeatures, [type]);
          break;
      }
    });

    ws.on('close', function () {
      clients.delete(wsId);
    });
  }
);

function sendDataToAll(type, data) {
  clients.forEach(function each(client) {
    if (client.readyState === webSocket.WebSocket.OPEN) {
      sendData(client, type, data);
    }
  });
}

function sendData(client, type, data) {
  const json = JSON.stringify({
    type: type,
    data: data
  })
  client.send(json);
}

function sendUpdateFeature(operation, feature, oldHash, newHash) {
  sendDataToAll('featureUpdate', {
    operation,
    feature,
    oldHash,
    newHash
  })
}

function sendFeaturesToAll() {
  sendDataToAll('allFeatures', features)
}

function sendFeatures(client) {
  sendData(client, 'allFeatures', features)
}

warapi.on(warapi.EVENT_WAR_ENDED, ({newData}) => {
  sendDataToAll('warEnded', newData)
})

warapi.on(warapi.EVENT_WAR_PREPARE, ({oldData, newData}) => {
  const oldWarDir = `./data/war${oldData.warNumber}`
  // backup old data
  if (!fs.existsSync(oldWarDir)) {
    fs.mkdirSync(oldWarDir)
  }
  if (fs.existsSync('./data/features.json')) {
    fs.cpSync('./data/features.json', oldWarDir + '/features.json')
  }
  if (fs.existsSync('./data/wardata.json')) {
    fs.cpSync('./data/wardata.json', oldWarDir + '/wardata.json')
  }
  // clear data
  features.features = features.features.filter((track) => track.properties.clan === 'World')
  saveFeatures(features)
  sendDataToAll('warPrepare', newData)
  sendFeaturesToAll()
})

warapi.on(warapi.EVENT_WAR_UPDATED, ({newData}) => {
  sendDataToAll('warChange', newData)
  sendFeaturesToAll()
})

module.exports = function (server) {
  server.on('upgrade', function (request, socket, head) {
    sessionParser(request, {}, () => {
      wss.handleUpgrade(request, socket, head, function (ws) {
        wss.emit('connection', ws, request);
      });
    });
  });
}