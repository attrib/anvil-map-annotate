const fs = require("fs");
const config = require('./config')

class WarApi {

  EVENT_WAR_UPDATED = 'warUpdated'
  EVENT_WAR_ENDED = 'warEnded'
  EVENT_WAR_PREPARE = 'warPrepareNext'
  WAR_IN_PROGRESS = 'ongoing'
  WAR_RESISTANCE = 'resistance'
  WAR_PREPARE = 'prepare'

  eTags = {}
  callbacks = {}

  constructor() {
    this.warData = fs.existsSync('./data/wardata.json') ? require('../data/wardata.json') : {shard: config.config.shard.name, warNumber: 0, status: this.WAR_IN_PROGRESS}
    if (!this.warData.status) {
      this.warData.status = this.getWarStatus(this.warData)
    }
  }

  on = (event, callback) => {
    if (!(event in this.callbacks)) {
      this.callbacks[event] = []
    }
    this.callbacks[event].push(callback)
  }

  emit = (event, data) => {
    if (event in this.callbacks) {
      for (const callback of this.callbacks[event]) {
        callback(data)
      }
    }
  }

  getWarStatus = (data = null) => {
    if (!data) {
      data = this.warData
    }
    const now = Date.now()
    if (data.winner === 'NONE' && data.conquestStartTime && now > data.conquestStartTime) {
      return this.WAR_IN_PROGRESS
    }
    // War end status for 12hours
    if (data.conquestEndTime && data.conquestEndTime + 43200000 > now) {
      return this.WAR_RESISTANCE
    }
    return this.WAR_PREPARE
  }

  warDataUpdate = (data) => {
    data.shard = config.config.shard.name
    if (this.warData.warNumber > data.warNumber) {
      return
    }
    if (((this.warData.status === this.WAR_PREPARE && data.warNumber === this.warData.warNumber) || (data.warNumber > this.warData.warNumber)) && data.status === this.WAR_IN_PROGRESS) {
      // We didn't prepare for this war!
      if (this.warData.status !== this.WAR_PREPARE) {
        console.log('Not prepared for war. Preparing now.')
        this.emit(this.EVENT_WAR_PREPARE, {
          newData: data,
          oldData: {...this.warData},
        })
      }
      console.log('A new war begins!')
      this.emit(this.EVENT_WAR_UPDATED, {
        newData: data,
        oldData: {...this.warData},
      })
    }
    else if (this.warData.status === this.WAR_IN_PROGRESS && data.status === this.WAR_RESISTANCE) {
      console.log('War is over!')
      this.emit(this.EVENT_WAR_ENDED, {
        newData: data,
        oldData: {...this.warData},
      })
    }
    else if ((this.warData.status === this.WAR_RESISTANCE || this.warData.status === this.WAR_IN_PROGRESS) && data.status === this.WAR_PREPARE) {
      console.log('War never ends!')
      data = {shard: config.config.shard.name, warNumber: data.warNumber + 1, status: this.WAR_PREPARE}
      this.emit(this.EVENT_WAR_PREPARE, {
        newData: data,
        oldData: {...this.warData},
      })
    }
    this.warData = data
    fs.writeFile(__dirname + '/../data/wardata.json', JSON.stringify(data, null, 2), err => {
      if (err) {
        console.error(err);
      }
    })
  }

}

module.exports = new WarApi()