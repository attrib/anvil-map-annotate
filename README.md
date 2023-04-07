# Anvil Map Annotate

Annotate and draw on the anvil map and share with your group.

## Bugs

Please create a Ticket in GitHub. Or of any the discord where you maybe heard about this tool.

## Todos

* save access control server
* anonymous access
* heatmap
* add more new icons?
* need to think about authentication
* change all texts, write new help

## Ideas


## DevTodos

* 

## Run Dev

Copy `.env.dist` to `.env`

Create the map tiles

```bash
cd public
mkdir map
cd map
wget https://cdn.discordapp.com/attachments/933535720767901777/1002752955361001492/AnvilMap.png
docker run --rm -v `pwd`:/tmp/files osgeo/gdal gdal2tiles.py -p raster -w openlayers --tiledriver=WEBP --webp-lossless /tmp/files/AnvilMap.png /tmp/files/
```

If you are using Windows Powershell and Docker on Windows

```powershell
docker run --rm -v ${PWD}:/tmp/files osgeo/gdal gdal2tiles.py -p raster -w openlayers --tiledriver=WEBP --webp-lossless /tmp/files/entiremap.png /tmp/files/
```

Install dependencies and run dev mode

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Run Live

Create a Discord OAuth 2 App (https://discord.com/developers/applications) and add `https://<yourdomain.tld>/connect/discord/callback` as redirect URL.

Copy `docker-compose.yml` to your webserver with docker and a traefik instance.

If not done already, see step how to create the map.

Change Host in `docker-compse.yml`

Run `docker compose up -d`

It will create a `data/config.yml`, please change all values there and then restart the app. 

### Access control

After first start it creates a file `./data/allowedUsers.yml`. Using yml so you can add comments!

Edit file and restart server for new permissions to take place. Users probably have to logout/login again.

```yaml
users:
  12345678901234567: full # full access for this user
roles:
  12345678901234569: # Server ID
    12345678901234570: icons # All users with this role, can add/edit icons
    12345678901234571: read # All users with this role, can only view the map
```
