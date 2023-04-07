import {Group, Heatmap, Vector} from "ol/layer";
import {Vector as VectorSource} from "ol/source";
import {Collection} from "ol";
import {GeoJSON} from "ol/format";

class HeatMaps {

  /**
   * @param {import("ol").Map} map
   */
  constructor(map) {
    this.heatMaps = {}
    this.group = new Group({
      title: 'Resource Heatmaps',
      fold: 'close',
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      tooltip: false,
      zIndex: 0,
      defaultVisible: false,
    })
    map.addLayer(this.group)
    this.icons = document.getElementById('ppe-filter-content')
  }

  initHeatMaps(heatMaps) {
    for (const heatMap of heatMaps) {
      this.heatMaps[heatMap] = new VectorSource({
        features: new Collection([]),
      })
      const [type, icon] = heatMap.split('-')
      const elements = this.icons.querySelector(`img[src^="/images/${type}/${icon}"]`)
      const vector = new Heatmap({
        source: this.heatMaps[heatMap],
        title: elements ? elements.title : heatMap,
        defaultVisible: false,
        visible: false,
      });
      this.group.getLayers().push(vector)

      vector.on('change:visible', (event) => {
        if (event.target.getVisible()) {
          this.loadHeatMap(heatMap)
        }
      })
    }
  }

  loadHeatMap(heatMap) {
    const source = this.heatMaps[heatMap]
    const geoJson = new GeoJSON();
    // todo: auto update here? not sure if ppl want this as you then can see indirectly where ppl place their icons
    if (source.getFeatures().length === 0) {
      fetch(`/api/heatmaps/${heatMap}`)
        .then((response) => response.json())
        .then((data) => {
          source.addFeatures(geoJson.readFeatures(data))
        })
    }
  }

  setSocket(socket) {
    this.socket = socket
    this.socket.on('heatmaps.newType', (data) => {
      this.initHeatMaps([data])
    })
  }
}

export default HeatMaps;