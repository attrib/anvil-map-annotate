import {Collection} from "ol";
import {GeoJSON} from "ol/format";

class LocalFeatureStorage {

  /**
   * @param {EditTools} tools
   */
  constructor(tools) {
    const warNumber = document.getElementById('warNumber').dataset.war;
    this.storage = window.localStorage.getItem('localFeatures') ? JSON.parse(window.localStorage.getItem('localFeatures')) : {warNumber: warNumber, features: {}};
    this.geoJson = new GeoJSON();
    if (warNumber !== this.storage.warNumber) {
      console.log('new war, resetting local features')
      this.clear();
    }
    this.tools = tools;
  }

  getAllFeatures() {
    const collection = new Collection();
    for (const feature of Object.values(this.storage.features)) {
      collection.push(this.geoJson.readFeature(feature));
    }
    return collection;
  }

  /**
   * @param {import("ol/Feature").default} feature
   */
  addFeature(feature) {
    feature.set('local', true);
    const id = 'local-' + Date.now() + '-' + Math.floor(Math.random() * 100000)
    feature.setId(id);
    feature.set('id', id);
    feature.set('user', 'Me (local)')
    feature.set('userId', 'local')
    feature.set('discordId', 'local')
    feature.set('time', (new Date()).toISOString())
    this.storage.features[feature.getId()] = this.geoJson.writeFeatureObject(feature);
    this.tools.emit(this.tools.EVENT_FEATURE_UPDATED, {operation: 'add', feature})
    this.save();
  }

  /**
   * @param {import("ol/Feature").default} feature
   */
  updateFeature(feature) {
    this.storage.features[feature.getId()] = this.geoJson.writeFeatureObject(feature);
    this.tools.emit(this.tools.EVENT_FEATURE_UPDATED, {operation: 'update', feature})
    this.save();
  }

  deleteFeature(id) {
    const feature = this.geoJson.readFeature(this.storage.features[id]);
    this.tools.emit(this.tools.EVENT_FEATURE_UPDATED, {operation: 'delete', feature: feature})
    delete this.storage.features[id];
    this.save();
  }

  clear() {
    this.storage = {warNumber: this.storage.warNumber, features: {}};
    this.save();
  }

  save() {
    console.log('save', Object.keys(this.storage.features).length, this.storage);
    window.localStorage.setItem('localFeatures', JSON.stringify(this.storage));
  }
}

export default LocalFeatureStorage;