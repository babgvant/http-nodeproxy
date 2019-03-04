/**
 *  Unifi-Presence Plugin
 *
 *  Author: andyvt@babgvant.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 */
var express = require('express');
var app = express();
var nconf = require('nconf');

const unifi = require('node-unifi');
let uvp = {
  sysinfo: {version:''}
};

var notify;
var logger = function(str) {
  mod = 'uvp';
  if(typeof str != "string"){
    str = JSON.stringify(str);
  }
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: `Unifi-Presence plugin running\r\nConnected to Unifi: ${nconf.get('unifi-presence:server')}:${nconf.get('unifi-presence:port')}` });
});

app.get('/mobiles', function (req, res) {
    res.status(200).json(mobiles);
  });

module.exports = function(f) {
  notify = f;
  return app;
};

let mobiles = nconf.get('unifi-presence:mobiles');
let pollFrequency = nconf.get('unifi-presence:pollFrequency');

if(pollFrequency && pollFrequency > 0) {
    setInterval(function(){
    let controller = new unifi.Controller(nconf.get('unifi-presence:server'), nconf.get('unifi-presence:port'));
        controller.login(nconf.get('unifi-presence:username'), nconf.get('unifi-presence:password'), function(err) {
            if(err) {
                logger(`ERROR: ${err}`);
            } else {
                var siteindex = nconf.get('unifi-presence:siteIndex');
                logger(`working with index ${siteindex}`);
                // GET SITE STATS 
                controller.getSitesStats(function(err, sites) {
                    logger(`getSitesStats: ${sites[siteindex].name} : ${sites.length}`);
                    // logger(sites);
                    if(err) {
                        logger(`ERROR: ${err}`);
                    } else {
                        // GET CLIENT DEVICES 
                        controller.getClientDevices(sites[siteindex].name, function(err, client_data) {
                            
                            if(err) {
                                logger(`ERROR: ${err}`);
                            } else {
                                logger(`getClientDevices: ${client_data[0].length}`);
                                // logger(client_data);
                                mobiles.forEach(function(mobile) {
                                    var found = client_data[0].filter(function (client) {
                                        if(mobile.mac && mobile.mac != ''){
                                            return mobile.mac == client.mac;
                                        } else {
                                            return mobile.name == client.name;
                                        }
                                    });

                                    mobile.present = (found.length > 0);
                                                                    
                                    let msg = {type: 'presence', state: mobile.present, update: mobile};
                                    // logger(msg);
                                    notify(msg);
                                });
                            }
                            
                            // FINALIZE, LOGOUT AND FINISH 
                            controller.logout();
                        });
                    }
                });
            }
        });
    }, pollFrequency);
}