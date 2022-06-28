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
 
 const Unifi = require('node-unifi');
 // const unifi = require('../../node-unifi/unifi.js');
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
 let host = nconf.get('unifi-presence:server');
 let port = nconf.get('unifi-presence:port');
 // let userName = 
 
 if(pollFrequency && pollFrequency > 0) {
     setInterval(function(){
         const unifi = new Unifi.Controller({host, port, sslverify: false});
         (async () => {
             try {
                 // LOGIN
                 const loginData = await unifi.login(nconf.get('unifi-presence:username'), nconf.get('unifi-presence:password'));
                 console.log('login: ' + loginData);
             
                 // GET CLIENT DEVICES
                 const clientData = await unifi.getClientDevices();
                 mobiles.forEach(function(mobile) {
                     var found = clientData.filter(function (client) {
                         if(mobile.mac && mobile.mac != ''){
                             return mobile.mac == client.mac;
                         } else {
                             let deviceName = client.name;
                             if(!deviceName){
                                 deviceName = client.hostname;
                             }
                             return mobile.name == deviceName;
                         }
                     });
 
                     mobile.present = (found.length > 0);
                                                     
                     let msg = {type: 'presence', state: mobile.present, update: mobile};
                     // logger(msg);
                     notify(msg);
                 });
 
                 // LOGOUT
                 const logoutData = await unifi.logout();
                 console.log('logout: ' + JSON.stringify(logoutData));
             } catch (error) {
                 console.log('ERROR: ' + error);
             }
         })();
     }, pollFrequency);
 }