import {Edit} from "./tools/edit";
import {ACL_READ, hasAccess} from "../lib/ACLS";
import {Select} from "./tools/select";
import {GeoJSON} from "ol/format";
import {Sidebar} from "./tools/sidebar";
import {Icon} from "./tools/icon";
import {Polygon} from "./tools/polygon";
import {Line} from "./tools/line";
import LayerGroup from "ol/layer/Group";

export class EditTools {
    EVENT_EDIT_MODE_ENABLED = 'editModeEnabled';
    EVENT_EDIT_MODE_DISABLED = 'editModeDisabled';
    EVENT_TOOL_SELECTED = 'toolSelected';
    EVENT_UPDATE_CANCELED = 'updateCanceled';
    EVENT_ICON_ADDED = 'iconAdded';
    EVENT_ICON_DELETED = 'iconDeleted';
    EVENT_ICON_UPDATED = 'iconUpdated';
    EVENT_FLAG = 'flagFeature'
    EVENT_FLAGGED = 'flaggedFeature'
    EVENT_UNFLAG = 'unflagFeature'
    EVENT_FEATURE_SELECTED = (type) => {
        const t = type === 'line' || type === 'polygon' || type === 'stormCannon' ? type : 'icon'
        return t + '-selected'
    }
    EVENT_FEATURE_DESELECTED = (type) => {
        const t = type === 'line' || type === 'polygon' || type === 'stormCannon' ? type : 'icon'
        return t + '-deselected'
    }
    EVENT_DECAY_UPDATE = 'decayUpdate'
    EVENT_DECAY_UPDATED = 'decayUpdated'
    EVENT_FEATURE_UPDATED = 'featureUpdated'

    MAGIC_MAP_SCALING_FACTOR = 0.94

    editMode = false
    selectedTool = false
    listeners = {}
    iconTools = {}

    /**
     * @param {import("ol").Map} map
     */
    constructor(map) {
        this.map = map

        this.userId = document.getElementById('discord-username')?.dataset.userId;
        this.geoJson = new GeoJSON();

        this.iconTools = {
            'fields': {
                title: 'Resources',
                type: 'fields',
                zIndex: 25,
                layerPerIcon: true,
            },
            'information': {
                title: 'Information\'s',
                type: 'information',
                zIndex: 50,
            },
            'base': {
                title: 'Bases',
                type: 'base',
                zIndex: 30,
            },
        }

        this.sidebar = new Sidebar(this, map)
        this.icon = new Icon(this, map)
        this.line = new Line(this, map)
        this.polygon = new Polygon(this, map)
        this.select = new Select(this, map)
        this.edit = new Edit(this, map)
    }

    resetAcl = () => {
        this.acl = ACL_READ;
        this.map.removeControl(this.edit.control)
        this.sidebar.setAcl(this.acl)
    }

    initAcl = (acl) => {
        this.acl = acl;
        if (acl !== ACL_READ) {
            this.map.addControl(this.edit.control)
        }
        this.sidebar.setAcl(acl)
    }

    hasAccess = (action, feature = null) => {
        return hasAccess(this.userId, this.acl, action, this.geoJson.writeFeatureObject(feature))
    }

    changeMode = (newMode) => {
        if (newMode === undefined) {
            newMode = !this.editMode
        }
        if (this.editMode !== newMode) {
            this.editMode = newMode
            if (this.editMode) {
                this.emit(this.EVENT_EDIT_MODE_ENABLED)
                const editLayerTitles = [ 'Custom Areas', 'Train Lines', ...Object.keys(this.iconTools).map((key) => { return this.iconTools[key].title})]
                const nestVisibleTrue = (layer) => {
                    if (layer instanceof LayerGroup) {
                        layer.getLayers().forEach((subLayer) => { nestVisibleTrue(subLayer) })
                    }
                    layer.setVisible(true)
                }
                this.map.getLayers().forEach((layer) => {
                    if (editLayerTitles.includes(layer.get('title'))) { nestVisibleTrue(layer) }
                })
            }
            else {
                if (this.selectedTool) {
                    this.selectedTool = false
                    this.emit(this.EVENT_TOOL_SELECTED, this.selectedTool)
                }
                this.emit(this.EVENT_EDIT_MODE_DISABLED)
            }
        }
    }

    changeTool = (newTool) => {
        if (this.editMode) {
            this.selectedTool = this.selectedTool !== newTool ? newTool : false
            this.emit(this.EVENT_TOOL_SELECTED, this.selectedTool)
        }
    }

    emit = (key, data) => {
        console.log("tools emit: " + key)
        if (key in this.listeners) {
            for (const listener of this.listeners[key]) {
                listener(data)
            }
        }
    }

    on = (key, callback) => {
        if (!(key in this.listeners)) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback)
    }

}
