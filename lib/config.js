const YAML = require("yaml")
const fs = require("fs");

const CONFIG_FILE = __dirname + '/../data/config.yml'

if (!fs.existsSync(CONFIG_FILE)) {
  fs.copyFileSync(__dirname + '/../config.dist.yml', CONFIG_FILE)
}

class Config {

  constructor() {
    this.readConfig()
    fs.watch(CONFIG_FILE, (event) => {
      if (event === 'change') {
        console.log('Config changed. Reloading.')
        this.readConfig()
      }
    })
  }

  readConfig = () => {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8')
    const parsed = YAML.parse(content, {intAsBigInt: true});
    if (parsed) {
      this.config = this.configUpdate(parsed)
    }
  }

  save = () => {
    fs.writeFile(CONFIG_FILE, YAML.stringify(this.config, {intAsBigInt: true}), () => {})
  }

  configUpdate = (config) => {
    return config
  }

}

module.exports = new Config()