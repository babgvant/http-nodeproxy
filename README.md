Usage node ./server.js

## Install

git clone 

cd http-nodeproxy

npm install

## Config

rename config.json.sample -> config.json and change accordingly

##Ubuntu Service Install

1) Install PM2: sudo npm install -g pm2 (if not already installed)
2) Navigate to install folder (e.g. cd\usr\src\http-nodeproxy) 
3) Run pm2 start server.js
4) Run pm2 startup systemd (if not already configured to autostart)
5) Follow directions