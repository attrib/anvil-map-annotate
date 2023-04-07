const fs = require("fs");
const hash = require('object-hash');

const FEATURE_FILE = __dirname + '/../data/features.json'
const HEATMAP_FILE = __dirname + '/../data/heatmap.json'

featureUpdater = (features) => {
  return features
}

function loadFeatures() {
  if (!fs.existsSync(FEATURE_FILE)) {
    return {
      type: 'FeatureCollection',
      features: [],
    }
  }
  const content = fs.readFileSync(FEATURE_FILE, 'utf8')
  const parsed = JSON.parse(content)
  return featureUpdater(parsed)
}
function saveFeatures(features) {
  features.hash = hash(features)
  fs.writeFile(FEATURE_FILE, JSON.stringify(features), err => {
    if (err) {
      console.error(err);
    }
  });
}

let loadedHeatmap = null
function loadHeatmap() {
  if (loadedHeatmap !== null) {
    return loadedHeatmap
  }
  if (!fs.existsSync(HEATMAP_FILE)) {
    return {}
  }
  const content = fs.readFileSync(HEATMAP_FILE, 'utf8')
  loadedHeatmap = JSON.parse(content)
  return loadedHeatmap
}

function getHeatmapType(type) {
  if (loadedHeatmap === null) {
    loadHeatmap()
  }
  if (loadedHeatmap[type] === undefined) {
    return {
      type: 'FeatureCollection',
      features: [],
    }
  }
  return loadedHeatmap[type]
}

function saveHeatmap(features, typesUpdate = []) {
  if (typesUpdate.length === 0) {
    typesUpdate = Object.keys(features)
  }
  for (const type of typesUpdate) {
    const mergedFeatures = []
    for (const feature of features[type].features) {
      const existing = mergedFeatures.find((f) => {
        if (f.geometry.type !== 'Point') {
          return false
        }
        return Math.round(f.geometry.coordinates[0] / 10) === Math.round(feature.geometry.coordinates[0] / 10) &&
          Math.round(f.geometry.coordinates[1] / 10) === Math.round(feature.geometry.coordinates[1] / 10)
      })
      if (existing) {
        existing.properties.weight += feature.properties.weight
      } else {
        mergedFeatures.push(feature)
      }
    }
    features[type].features = mergedFeatures
  }
  fs.writeFile(HEATMAP_FILE, JSON.stringify(features), err => {
    if (err) {
      console.error(err);
    }
  });
}

module.exports = {loadFeatures, saveFeatures, loadHeatmap, saveHeatmap, getHeatmapType}