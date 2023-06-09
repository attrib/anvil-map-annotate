import TileGrid from "ol/tilegrid/TileGrid";
import {Map, View} from "ol";
import {defaults} from "ol/control";
import {Group, Tile} from "ol/layer";
import {TileImage} from "ol/source";
import {GeoJSON} from "ol/format";
import {addDefaultMapControls, enableLayerMemory} from "./mapControls"
import {Socket} from "./webSocket";
import {DragPan} from "ol/interaction";
import {all, noModifierKeys} from "ol/events/condition";
import {assert} from "ol/asserts";
import {Flags} from "./flags";
import {EditTools} from "./mapEditTools";
import LocalFeatureStorage from "./localFeatureStorage";
import HeatMaps from "./heatmaps";

const url = new URL(window.location);

const map = new Map({
  controls: defaults(),
  target: 'map',
  layers: [
    new Group({
      // title: 'Map',
      // combine: true,
      layers: [
        new Tile({
          title: 'Map',
          type: 'base',
          preload: Infinity,
          // opacity: 0.7,
          source: new TileImage({
            attributions: '<a href="https://www.anvilempires.com" target="_blank">Siege Camp</a>',
            tileGrid: new TileGrid({
              extent: [0,-3981,5016,0],
              origin: [0,-3981],
              resolutions: [32,16,8,4,2,1],
              tileSize: [256, 256]
            }),
            tileUrlFunction: function(tileCoord) {
              return ('/map/{z}/{x}/{y}.webp'
                .replace('{z}', String(tileCoord[0]))
                .replace('{x}', String(tileCoord[1]))
                .replace('{y}', String(- 1 - tileCoord[2])));
            },
          })
        }),
      ]
    }),
  ],
  view: new View({
    center: [url.searchParams.get('cx') ? parseFloat(url.searchParams.get('cx')) : 2508.000000, url.searchParams.get('cy') ? parseFloat(url.searchParams.get('cy')) : -1990.000000],
    resolution: url.searchParams.get('r') ? parseFloat(url.searchParams.get('r')) : 8.000000,
    minResolution: 0.125,
    maxResolution: 16,
  })
});

map.on('moveend', (event) => {
  const center = event.map.getView().getCenter()
  const url = new URL(window.location);
  url.searchParams.set('cx', center[0].toFixed(5));
  url.searchParams.set('cy', center[1].toFixed(5));
  url.searchParams.set('r', event.map.getView().getResolution().toFixed(5));
  window.history.replaceState({}, '', url);
})

addDefaultMapControls(map)

const warFeatures = localStorage.getItem('warFeatures') ? JSON.parse(localStorage.getItem('warFeatures')) : {version: '', features: [], deactivatedRegions: []}
const conquerStatus = localStorage.getItem('conquerStatus') ? JSON.parse(localStorage.getItem('conquerStatus')) : {version: '', features: {}}
const heatMap = new HeatMaps(map)
const tools = new EditTools(map);
enableLayerMemory(map)

// Prevent context menu on map
document.getElementById('map').addEventListener('contextmenu', (e) => {
  if (tools.editMode) {
    e.preventDefault();
    return false;
  }
})

// Allow panning with middle mouse
const primaryPrimaryOrMiddle = function (mapBrowserEvent) {
  const pointerEvent = /** @type {import("../MapBrowserEvent").default} */ (
    mapBrowserEvent
  ).originalEvent;
  assert(pointerEvent !== undefined, 56); // mapBrowserEvent must originate from a pointer event
  return pointerEvent.isPrimary && (pointerEvent.button === 0 || pointerEvent.button === 1);
}
map.getInteractions().forEach((interaction) => {
  if (interaction instanceof DragPan) {
    interaction.condition_ = all(noModifierKeys, primaryPrimaryOrMiddle)
  }
})

const geoJson = new GeoJSON();
const socket = new Socket();

let lastClientVersion = null
let lastFeatureHash = ''
let realACL = null
heatMap.setSocket(socket)
socket.on('init', (data) => {
  realACL = data.acl
  if (data.warStatus === 'resistance') {
    data.acl = 'read'
  }
  tools.initAcl(data.acl)
  if (lastClientVersion === null) {
    lastClientVersion = data.version
  }
  else if (lastClientVersion !== data.version) {
    console.log('Version change detected, reloading page')
    window.location = '/'
  }
  if (data.heatMaps) {
    heatMap.initHeatMaps(data.heatMaps)
  }
})

const localFeatureStorage = new LocalFeatureStorage(tools)

tools.on(tools.EVENT_ICON_ADDED, (icon) => {
  const data = geoJson.writeFeatureObject(icon)
  if (tools.globalEditMode === tools.GLOBAL_MODE_LOCAL) {
    localFeatureStorage.addFeature(icon)
    // Sending feature to server to update heat map
    socket.send('heatMapFeature', data)
  }
  else {
    socket.send('featureAdd', data)
    socket.send('heatMapFeature', data)
  }
})

tools.on(tools.EVENT_ICON_UPDATED, (icon) => {
  if (icon && icon.get('id')) {
    const data = geoJson.writeFeatureObject(icon)
    if (tools.globalEditMode === tools.GLOBAL_MODE_LOCAL) {
      localFeatureStorage.updateFeature(icon)
      // Sending feature to server to update heat map
      socket.send('heatMapFeature', data)
    }
    else {
      socket.send('featureUpdate', data)
      socket.send('heatMapFeature', data)
    }
  }
})

tools.on(tools.EVENT_ICON_DELETED, (icon) => {
  if (icon && icon.get('id')) {
    if (tools.globalEditMode === tools.GLOBAL_MODE_LOCAL) {
      localFeatureStorage.deleteFeature(icon.get('id'))
    }
    else {
      socket.send('featureDelete', {id: icon.get('id')})
    }
  }
})

socket.on('allFeatures', (features) => {
  const col = geoJson.readFeatures(features)
  const collections = {}
  col.forEach((feature) => {
    const type = feature.get('type')
    if (!(type in collections)) {
      collections[type] = []
    }
    collections[type].push(feature)
  })
  localFeatureStorage.getAllFeatures().forEach((feature) => {
    const type = feature.get('type')
    if (!(type in collections)) {
      collections[type] = []
    }
    collections[type].push(feature)
  })
  for (const type in tools.icon.sources) {
    tools.icon.sources[type].clear(true)
    tools.icon.sources[type].addFeatures(collections[type] || [])
  }
  tools.polygon.source.clear(true)
  tools.polygon.source.addFeatures(collections['polygon'] || [])
  for (const clan in tools.line.sources) {
    tools.line.sources[clan].clear(true)
  }
  tools.line.allLinesCollection.clear()
  tools.line.allLinesCollection.extend(collections['line'] || [])
  lastFeatureHash = features.hash
})

socket.on('featureUpdate', ({operation, feature, oldHash, newHash}) => {
  if (lastFeatureHash !== oldHash) {
    socket.send('getAllFeatures', true)
    return
  }
  feature = geoJson.readFeature(feature)
  tools.emit(tools.EVENT_FEATURE_UPDATED, {operation, feature})
  lastFeatureHash = newHash
})

tools.on(tools.EVENT_DECAY_UPDATE, (data) => {
  socket.send('decayUpdate', data)
})

socket.on('decayUpdated', (data) => {
  tools.emit(tools.EVENT_DECAY_UPDATED, data)
})

tools.on(tools.EVENT_FLAG, (data) => {
  socket.send('flag', data)
})

socket.on('flagged', (data) => {
  tools.emit(tools.EVENT_FLAGGED, data)
})

tools.on(tools.EVENT_UNFLAG, (data) => {
  socket.send('unflag', data)
})

new Flags(map, tools)

socket.on('warEnded', (data) => {
  document.getElementById('warNumber').innerHTML = `#${data.warNumber} (Resistance)`
  document.getElementById('warNumber').dataset.war = data.warNumber
  tools.resetAcl()
})

socket.on('warPrepare', (data) => {
  conquerStatus.version = ''
  conquerStatus.features = {}
  warFeatures.features = []
  warFeatures.deactivatedRegions = []
  warFeatures.version = ''
  localStorage.setItem('warFeatures', JSON.stringify(warFeatures))
  localFeatureStorage.clear()
  document.getElementById('warNumber').innerHTML = `#${data.warNumber} (Preparing)`
  document.getElementById('warNumber').dataset.war = data.warNumber
  if (realACL) {
    tools.initAcl(realACL)
  }
})

socket.on('warChange', (data) => {
  conquerStatus.version = ''
  conquerStatus.features = {}
  warFeatures.features = []
  warFeatures.deactivatedRegions = []
  warFeatures.version = ''
  localFeatureStorage.clear()
  document.getElementById('warNumber').innerHTML = `#${data.warNumber}`
  document.getElementById('warNumber').dataset.war = data.warNumber
})

const disconnectedWarning = document.getElementById('disconnected')
socket.on('open', () => {
  disconnectedWarning.style.display = 'none'
  socket.send('init', {
    conquerStatus: conquerStatus.version,
    featureHash: lastFeatureHash,
    warVersion: warFeatures.version,
  })
})
socket.on('close', () => {
  disconnectedWarning.style.display = 'block'
})

// Modal
const myModal = new bootstrap.Modal(document.getElementById('modal'), {})
const modalBody = document.getElementById('modalBody')
const modalTitle = document.getElementById('modalLabel')

for (const link of document.getElementsByClassName('modal-toggle')) {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    modalTitle.innerHTML = event.target.innerHTML
    fetch(event.target.href + '?raw=1')
      .then((data) => {
        return data.text()
      })
      .then((data) => {
        modalBody.innerHTML = data
        myModal.show()
      })
  })
}