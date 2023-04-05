const fs = require("fs");
const hash = require('object-hash');

const FEATURE_FILE = __dirname + '/../data/features.json'

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

module.exports = {loadFeatures, saveFeatures}