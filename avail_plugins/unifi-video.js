/**
 *  Unifi-Video Plugin
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

const UfvConstants = require('../lib/ufvconstants');
const UfvApi = require('../lib/ufvapi');
let uvc = {
  sysinfo: {version:''}
};

var notify;
var logger = function(str) {
  mod = 'uvc';
  if(typeof str != "string"){
    str = JSON.stringify(str);
  }
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: `Unifi-Video plugin running\r\nConnected to Unifi version: ${uvc.sysinfo.version}` });
});

app.get('/snapshot/:mac', function (req, res) {
  api.FindCamera(req.params.mac)
    .then(camera=>{
      api.Snapshot(camera, 1920)
        .then(img => {           
          res.contentType('image/jpeg'); 
          res.end(img, 'binary');
        });
    }).catch(e=>{
      logger(e);      
      res.end();
    });
});

app.get('/camera/:mac', function (req, res) {
  api.FindCamera(req.params.mac)
    .then(camera=>{
      res.status(200).json(camera);
    }).catch(e=>{
        console.log(e);     
        res.end();
    });
});

module.exports = function(f) {
  notify = f;
  return app;
};

let camSettings = nconf.get('unifi-video:cameras');
let pollFrequency = nconf.get('unifi-video:pollFrequency');
let api = new UfvApi();
api.on(UfvConstants.API_HOST, apihost => {
  logger(`Set API_HOST: ${apihost}`);
});
api.on(UfvConstants.API_KEY, apikey => {    
    logger(`Set API_KEY: ${apikey}`);
});

api.SetApiHost(nconf.get('unifi-video:host'));
api.SetApiKey(nconf.get('unifi-video:apiKey'));
api.GetSysInfo()
    .then(sysinfo => {
      uvc.sysinfo = sysinfo;
      logger('[DEVICE] UVC-NVR found running UniFi Video version: ' + sysinfo.version);
    })
    .catch(sysinfo => {
      logger('error getting sysinfo');
      logger(sysinfo);
    });

api.GetCameras()
  .then(cameras => {
      this._cameras = cameras;
      let dirty = false;
      if(!camSettings){
        camSettings = [];
      }

      for (let i = 0; i < this._cameras.length; i++) {
          let camera = this._cameras[i];
          let wc = {
            'name':camera.name,
            'model':camera.model,
            'mac': camera.mac,
            'address': camera.host
          };
          logger(wc);

          let fc = camSettings.find(x => x.mac == camera.mac);
          if(!fc){ //add the camera if it's not found
            wc.deviceId = 0;
            camSettings[camSettings.length] = wc;
            dirty = true;
          }
        }

        if(dirty){
          nconf.set('unifi-video:cameras', camSettings);
          nconf.save(function (err) {
            logger(err);
          });
        }

        if(pollFrequency && pollFrequency > 0) {
          setInterval(function(){
            // logger('poll unifi');
            camSettings.forEach(cam => {
              if(cam.deviceId != 0) {
                // logger(`check ${cam.name} for motion`);
                api.FindCamera(cam.mac)
                  .then(camera=>{
                    // let d = new Date(camera.lastRecordingStartTime);                    
                    // logger(`${cam.name} ${d}`);
                    if(cam.lastRecordingStartTime && cam.lastRecordingStartTime < camera.lastRecordingStartTime){
                      logger(`${cam.name} motion: ${camera.lastRecordingStartTime}`);
                      cam.type ='motion';
                      cam.lastRecordingId = camera.lastRecordingId;
                      let msg = {type: 'camera', state: 'open', update: cam};
                      // logger(msg);
                      notify(msg);
                    } else if (cam.lastRecordingId) {
                      // logger(`check recording status`);
                      api.GetRecordings(0,0,cam.lastRecordingId)
                        .then(recordings => {
                            // logger(recordings);
                            if(!recordings[0].inProgress){      
                              logger(`${cam.name} recording ${cam.lastRecordingId} complete`);
                              cam.lastRecordingId = null;
                              let msg = {type: 'camera', state: 'closed', update: cam};
                              // logger(msg);
                              notify(msg);
                            } 
                        })
                        .catch(error => {
                          logger(`error getting recording: ${error}`);
                          cam.lastRecordingId = null;
                        });
                    }

                    cam.lastRecordingStartTime = camera.lastRecordingStartTime;
                  }).catch(e=>{
                      console.log(e);
                  });
              }
            });
          }, pollFrequency);
        }
  })
  .catch(error=>{
    logger('error getting cameras');
    logger(error);
  });

